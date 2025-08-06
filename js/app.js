// ==========================
// CONFIGURACIÓN DE VISORES
// ==========================
const visores = {
  neiva: {
    nombre: "Visor Neiva",
    center: [2.93, -75.28],
    zoom: 12,
    capas: {
      Terreno: { archivo: "data/neiva/TerrenoFinal.geojson", estilo: { color: 'orange', weight: 0.6, fillOpacity: 0.2 }, minZoom: 18, maxZoom: 22 },
      Unidades: { archivo: "data/neiva/UnidadesFinal.geojson", estilo: { color: 'purple', weight: 0.6, fillOpacity: 0.2 }, minZoom: 19, maxZoom: 22 },
      Barrios: { archivo: "data/neiva/barrios.geojson", estilo: { color: 'green', weight: 0.6, fillOpacity: 0.2 }, minZoom: 16, maxZoom: 17 },
      Comunas: { archivo: "data/neiva/comunas.geojson", estilo: { color: 'blue', weight: 0.6, fillOpacity: 0.2 }, minZoom: 0, maxZoom: 15 }
    }
  },

  san_juan: {
    nombre: "Visor San Juan",
    center: [3.01, -75.50],
    zoom: 13,
    capas: {
      Terreno: { archivo: "data/san_juan/CR_UnidadConstruccion.geojson", estilo: { color: 'orange', weight: 0.6, fillOpacity: 0.2 }, minZoom: 18, maxZoom: 22 },
      Barrios: { archivo: "data/san_juan/CR_Terreno_Predio.geojson", estilo: { color: 'green', weight: 0.6, fillOpacity: 0.2 }, minZoom: 16, maxZoom: 17 },
      Comunas: { archivo: "data/san_juan/CR_Construccion.geojson", estilo: { color: 'blue', weight: 0.6, fillOpacity: 0.2 }, minZoom: 0, maxZoom: 15 }
    }
  }
};

// ==========================
// SELECCIÓN DE VISOR POR URL
// ==========================
const params = new URLSearchParams(window.location.search);
const nombreVisor = params.get('mapa') || 'neiva'; // valor por defecto
const configVisor = visores[nombreVisor];

if (!configVisor) {
  alert("Visor no encontrado, usando Neiva por defecto");
}

// ==========================
// INICIALIZAR MAPA
// ==========================
const vial = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors',
});

const satelital = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 19,
  attribution: '&copy; Esri &mdash; Maxar &mdash; Earthstar Geographics'
});

const hibrido = L.layerGroup([
  satelital,
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, opacity: 0.3 })
]);

const map = L.map('map', {
  center: configVisor.center,
  zoom: configVisor.zoom,
  layers: [vial]
});

L.control.scale({ position: 'bottomleft' }).addTo(map);

let capasVisibles = {};
let geojsonOriginal = {};

// ==========================
// CARGA DE CAPAS GEOJSON
// ==========================
for (const nombre in configVisor.capas) {
  const { archivo } = configVisor.capas[nombre];
  fetch(archivo)
    .then(res => res.json())
    .then(data => geojsonOriginal[nombre] = data);
}

// ==========================
// FUNCIÓN POPUP
// ==========================
function generarPopup(feature, nombreCapa) {
  let popup = "";
  for (let key in feature.properties) {
    popup += `<strong>${key}:</strong> ${feature.properties[key]}<br>`;
  }
  return popup || "Sin información";
}

// ==========================
// TOGGLE DE CAPAS
// ==========================
function toggleCapa(nombre) {
  const checkbox = document.getElementById('capa' + nombre);
  const config = configVisor.capas[nombre];
  const geojson = geojsonOriginal[nombre];
  if (!config || !geojson) return;

  if (checkbox.checked) {
    if (!capasVisibles[nombre]) {
      capasVisibles[nombre] = L.geoJSON(geojson, {
        style: () => config.estilo,
        onEachFeature: (feature, layer) => {
          layer.bindPopup(generarPopup(feature, nombre));
        }
      }).addTo(map);
    }
  } else {
    if (capasVisibles[nombre]) {
      map.removeLayer(capasVisibles[nombre]);
      capasVisibles[nombre] = null;
    }
  }
}

// ==========================
// FILTRO SIMPLE
// ==========================
function filtrarCapa() {
  const capaNombre = document.getElementById('filtro-capa').value;
  const campo = document.getElementById('filtro-campo').value;
  const valor = document.getElementById('filtro-valor').value.toLowerCase();
  if (!capaNombre || !campo || !valor) return;

  const base = geojsonOriginal[capaNombre]?.features || [];
  const filtradas = base.filter(f => (f.properties?.[campo] || '').toString().toLowerCase() === valor);

  if (window.capaFiltrada) map.removeLayer(window.capaFiltrada);

  window.capaFiltrada = L.geoJSON({ type: 'FeatureCollection', features: filtradas }, {
    style: { color: 'yellow', weight: 2, fillOpacity: 0.6 },
    onEachFeature: (feature, layer) => {
      layer.bindPopup(generarPopup(feature, capaNombre));
    }
  }).addTo(map);

  if (filtradas.length > 0) map.fitBounds(window.capaFiltrada.getBounds());
}
