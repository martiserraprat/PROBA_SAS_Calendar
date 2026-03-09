// ========================================
// athlete-dashboard.js - Datos del atleta
// ========================================

// Datos de ejemplo (luego vendrán de Supabase/API)
const atletaData = {
    nombre: "Carlos Rodríguez",
    pais: "España",
    fechaNacimiento: "15 MAY 1998",
    club: "CA Fent Camí",
    entrenador: "José Martínez",
    
    estadisticas: {
        mejorMarca: "10.02",
        disciplina: "100m",
        competicionesAnio: 12,
        rankingNacional: 24,
        proximaCita: 3 // días
    },
    
    proximasCompeticiones: [
        {
            fecha: "2026-03-15",
            nombre: "Campeonato de España",
            lugar: "Madrid",
            prueba: "100m",
            estado: "confirmado"
        },
        {
            fecha: "2026-03-22",
            nombre: "Meeting Internacional",
            lugar: "Barcelona",
            prueba: "200m",
            estado: "pendiente"
        },
        {
            fecha: "2026-04-05",
            nombre: "Liga de Clubes",
            lugar: "Valencia",
            prueba: "4x100m",
            estado: "inscrito"
        }
    ],
    
    ultimasMarcas: [
        {
            disciplina: "100m",
            marca: "10.02",
            lugar: "Madrid",
            fecha: "15 FEB 2026"
        },
        {
            disciplina: "200m",
            marca: "20.45",
            lugar: "Barcelona",
            fecha: "3 ENE 2026"
        },
        {
            disciplina: "400m",
            marca: "46.53",
            lugar: "Valencia",
            fecha: "22 DIC 2025"
        }
    ],
    
    highlights: [
        {
            tipo: "oro",
            competicion: "Campeonato de España",
            puesto: "1º",
            disciplina: "100m",
            año: "2025"
        },
        {
            tipo: "plata",
            competicion: "Meeting Barcelona",
            puesto: "2º",
            disciplina: "200m",
            año: "2025"
        },
        {
            tipo: "bronce",
            competicion: "Liga Nacional",
            puesto: "3º",
            disciplina: "4x100m",
            año: "2024"
        }
    ]
};

// Función para actualizar la UI con datos reales
function actualizarDashboard() {
    // Actualizar nombre
    const userNameEl = document.querySelector('.user-name');
    if (userNameEl) userNameEl.textContent = atletaData.nombre;
    
    // Actualizar estadísticas (esto luego vendrá de la BD)
    // Por ahora son datos estáticos en el HTML
}

// Inicializar
document.addEventListener('DOMContentLoaded', () => {
    actualizarDashboard();
    
    // Aquí iría la lógica para cargar datos reales
    console.log("Dashboard de atleta cargado");
});

// Funciones para navegación (si se necesitan)
function cambiarVista(vista) {
    // Lógica para cambiar entre tabs si es necesario
    console.log(`Cambiando a vista: ${vista}`);
}