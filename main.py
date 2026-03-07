import json
import asyncio
import aiohttp
import os
from playwright.async_api import async_playwright
from datetime import datetime

# --- CONFIGURACIÓN ---
JSON_FILENAME = "eventos_2026.json"
BASE_URL = "https://worldathletics.org/competition/calendar-results?offset="

async def capturar_api_config(context, eventos_brutos, api_config):
    """ Entra a la web para detectar los headers de la API GraphQL de World Athletics """
    page = await context.new_page()
    
    async def handle_request(request):
        if "graphql" in request.url and request.method == "POST":
            api_config["url"] = request.url
            # Copiamos headers necesarios para que no nos bloqueen
            for key, value in request.headers.items():
                if key.lower() not in ["content-length", "accept-encoding", "host"]:
                    api_config["headers"][key] = value

    async def handle_response(response):
        if "graphql" in response.url and response.status == 200:
            try:
                data = await response.json()
                if "data" in data and "getCalendarEvents" in data["data"]:
                    results = data["data"]["getCalendarEvents"]["results"]
                    if results: eventos_brutos.extend(results)
            except: pass

    page.on("request", handle_request)
    page.on("response", handle_response)
    
    await page.goto(BASE_URL + "0", wait_until="networkidle", timeout=60000)
    await asyncio.sleep(5) # Tiempo para que cargue la API
    await page.close()

async def fetch_details(session, event, api_url, headers, query, sem, progress):
    """ Obtiene las pruebas (disciplinas) y contactos de cada mitin """
    payload = {
        "operationName": "GetCompetitionOrganiserInfo",
        "variables": {"competitionId": event["id"]},
        "query": query
    }
    
    async with sem:
        try:
            async with session.post(api_url, headers=headers, json=payload, timeout=15) as resp:
                if resp.status != 200: return None
                data = await resp.json()
                info = data.get("data", {}).get("getCompetitionOrganiserInfo")
                if not info: return None

                # Limpieza de disciplinas (Evitamos duplicados y mapeamos Género)
                disciplines = []
                units = info.get("units", [])
                for u in units:
                    gender = u.get("gender", "Both")
                    for e_name in u.get("events", []):
                        # Solo guardamos si no existe la combinación
                        if not any(d['name'] == e_name and d['gender'] == gender for d in disciplines):
                            disciplines.append({"name": e_name, "gender": gender})

                progress[0] += 1
                print(f"✅ [{progress[0]}] {event['name'][:40]}...", end="\r")

                return {
                    "id": event["id"],
                    "name": event["name"],
                    "venue": event["venue"],
                    "area": event["area"],
                    "category": event["rankingCategory"],
                    "startDate": event["startDate"],
                    "disciplines": disciplines,
                    "links": {
                        "web": info.get("websiteUrl"),
                        "results": info.get("resultsPageUrl")
                    },
                    "contact": info.get("contactPersons", [])
                }
        except: return None

async def main():
    api_config = {"url": "", "headers": {}}
    eventos_brutos = []

    print("🛰️  Iniciando rastreador de World Athletics...")
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        
        # Fase 1: Detectar API y traer lista base
        await capturar_api_config(context, eventos_brutos, api_config)
        
        if not api_config["url"]:
            print("❌ Error: No se pudo detectar la API. Reintentando...")
            return

        # Fase 2: Filtrar solo 2026 y Europa (o lo que quieras)
        vistos = set()
        eventos_2026 = [
            e for e in eventos_brutos 
            if e.get("startDate", "").startswith("2026") 
            and e.get("area") == "Europe"
            and not (e["id"] in vistos or vistos.add(e["id"]))
        ]

        print(f"📂 Encontrados {len(eventos_2026)} eventos para 2026. Extrayendo pruebas...")

        query = """query GetCompetitionOrganiserInfo($competitionId: Int!) {
          getCompetitionOrganiserInfo(competitionId: $competitionId) {
            websiteUrl resultsPageUrl
            contactPersons { email name }
            units { events gender }
          }}"""

        # Fase 3: Peticiones masivas a la API para los detalles
        progress = [0]
        sem = asyncio.Semaphore(20) # 20 peticiones simultáneas para no ser bloqueados
        async with aiohttp.ClientSession() as session:
            tareas = [fetch_details(session, e, api_config["url"], api_config["headers"], query, sem, progress) for e in eventos_2026]
            resultados = await asyncio.gather(*tareas)

        final_data = [r for r in resultados if r]

        with open(JSON_FILENAME, "w", encoding="utf-8") as f:
            json.dump(final_data, f, indent=2, ensure_ascii=False)

        print(f"\n\n🏆 ¡LISTO! {len(final_data)} mítines guardados en {JSON_FILENAME}")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())