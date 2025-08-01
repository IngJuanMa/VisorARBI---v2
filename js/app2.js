// Cargue de la capa en leaflet y link donde se optiene el mapa para la vial
const vial = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors',
});

// Cargue de la capa en leaflet y link donde se optiene el mapa para la satelital (dicha capa al ser de Esri y de caracter gratuito solo posee una resolución max de 18)
const satelital = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 19,
  attribution: '&copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
});

// Cargue de la capa en leaflet y link donde se optiene el mapa para la satelital con la vial a la cual se le reduce la opacidad
const hibrido = L.layerGroup([
  satelital,
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    opacity: 0.3
  })
]);

// Crea el mapa base dandoles las coordenadas inciales (Neiva, Colombia) con un zoom de 12 y enciende la capa vial por defecto
const map = L.map('map', {
  center: [2.93, -75.28],
  zoom: 12,
  layers: [vial],
  // Configuraciones para móviles
  tap: true,
  touchZoom: true,
  doubleClickZoom: true,
  scrollWheelZoom: true,
  boxZoom: false,
  keyboard: true,
  zoomControl: true,
  attributionControl: true
});

// Creamos una capa pane que funciona principalmente para el uso de canvas y establecer el orden en que se superponen las imagenes
map.createPane('canvas-pane');
map.getPane('canvas-pane').style.zIndex = 400;

// Objeto para gestionar las capas base
const baseMaps = {
  "vial": vial,
  "satelital": satelital,
  "hibrido": hibrido
};

// Capa base inicial
let capaBaseActual = vial;

// Función: Cambiar la capa base del mapa
function cambiarMapaBase(tipoMapa) {
  // Validación y cambio de capa
  const nuevaCapa = baseMaps[tipoMapa];
  if (!nuevaCapa) {
    console.warn(`La capa "${tipoMapa}" no está definida en baseMaps.`);
    return;
  }
  if (capaBaseActual) {
    map.removeLayer(capaBaseActual);
  }
  capaBaseActual = nuevaCapa;
  map.addLayer(capaBaseActual);
  actualizarEstadoVisualCapas(tipoMapa);
  console.log(`Capa base cambiada a: ${tipoMapa}`);
}

// Función: Actualizar los estilos visuales de los botones de capa
function actualizarEstadoVisualCapas(capaActiva) {
  const articulos = document.querySelectorAll('.capa-vista');
  articulos.forEach(article => {
    const onclickAttr = article.getAttribute('onclick') || "";
    const esActiva = onclickAttr.includes(`'${capaActiva}'`);
    article.classList.toggle('activa', esActiva);
  });
}

// Inicializar el estado visual al cargar la página
document.addEventListener('DOMContentLoaded', function () {
  // Marcar la capa inicial como activa (vial)
  actualizarEstadoVisualCapas('vial');
});

// Hacer la función global para que funcione con onclick
window.cambiarMapaBase = cambiarMapaBase;

// Aquí puedes añadir también tus capas vectoriales si quieres mostrarlas en el control
L.control.scale({ position: 'bottomleft' }).addTo(map);

// Creación de variables para control de capas
let capaZonaActual = null;
let capaFiltrada = null;
const capasGeojson = {};
const geojsonOriginal = {};

// const controlCapas = L.control.layers({}, {}).addTo(map); // Desactivado por menú personalizado

const configuracionCapas = {
  "Unidades": { archivo: "UnidadesFinal.geojson", estilo: { color: 'purple', weight: 0.6, fillOpacity: 0.2 }, minZoom: 19, maxZoom: 22 },
  "Barrios": { archivo: "barrios.geojson", estilo: { color: 'green', weight: 0.6, fillOpacity: 0.2 }, minZoom: 16, maxZoom: 17 },
  "Comunas": { archivo: "comunas.geojson", estilo: { color: 'blue', weight: 0.6, fillOpacity: 0.2 }, minZoom: 0, maxZoom: 15 },
  "Terreno": { archivo: "TerrenoFinal.geojson", estilo: { color: 'orange', weight: 0.6, fillOpacity: 0.2 }, minZoom: 18, maxZoom: 22 },
  "Construccion": { archivo: "ConstruccionFinal.geojson", estilo: { color: 'yellow', fillColor: '#002f559d', weight: 0.6, fillOpacity: 0.4 }, minZoom: 19, maxZoom: 22 }
};

// Traer los GeoJson desde la carpeta data (Por como funciona la otra pagina se debera cambiar para que no se enceuntren dentro de una carpeta o corregir la ruta la encontrarse en la nube)
for (const nombre in configuracionCapas) {
  const { archivo } = configuracionCapas[nombre];
  fetch(`data/${archivo}`)
    .then(res => res.json())
    .then(data => {
      geojsonOriginal[nombre] = data;
      console.log(`Capa ${nombre} descargada`);
    });
}

let capasVisibles = {}; // Guarda referencias a capas activas
let timeoutTerreno = null; // Para controlar la carga pendiente

// Loader para capa Terreno con animaciones
function mostrarLoaderTerreno() {
  const loader = document.getElementById('loader-terreno');
  if (loader) {
    // Mostrar el elemento
    loader.style.display = 'flex';
    // Forzar un reflow para que la transición funcione
    loader.offsetHeight;
    // Agregar clase para animación de entrada
    loader.classList.add('show');
    loader.classList.remove('hide');
  }
}

function ocultarLoaderTerreno() {
  const loader = document.getElementById('loader-terreno');
  if (loader) {
    // Agregar clase para animación de salida
    loader.classList.add('hide');
    loader.classList.remove('show');
    // Ocultar completamente después de la animación
    setTimeout(() => {
      if (loader.classList.contains('hide')) {
        loader.style.display = 'none';
        loader.classList.remove('hide');
      }
    }, 300); // Tiempo debe coincidir con la duración de la transición CSS
  }
}


map.on('moveend zoomend', () => {
  const zoom = map.getZoom();

  for (const nombre in configuracionCapas) {
    const config = configuracionCapas[nombre];
    const geojson = geojsonOriginal[nombre];
    if (!geojson) continue;

    const isVisible = zoom >= config.minZoom && zoom <= config.maxZoom;
    const checkbox = document.getElementById('capa' + nombre);
    const isChecked = checkbox && checkbox.checked;

    // Si el usuario desactivó manualmente, no la reactivo
    if (!isChecked && checkbox && checkbox.dataset.manual === 'true') {
      continue;
    }

    // Si entra en rango de zoom y no está activa, la creo
    if (isVisible && !capasVisibles[nombre]) {
      capasVisibles[nombre] = L.geoJSON(geojson, {
        pane: 'canvas-pane',
        renderer: L.canvas(),
        style: () => config.estilo,
        onEachFeature: (f, l) => l.bindPopup(generarPopup(f, nombre))
      }).addTo(map);
      if (checkbox) checkbox.checked = true;
    }

    // Si sale del rango de zoom y estaba activa, la quito
    if (!isVisible && capasVisibles[nombre]) {
      map.removeLayer(capasVisibles[nombre]);
      capasVisibles[nombre] = null;
      if (checkbox) checkbox.checked = false;
    }
  }
});



map.on('overlayadd', e => {
  const nombre = e.name;
  // Pantalla de carga para la capa Terreno
  if (nombre === 'Terreno') mostrarLoaderTerreno();

  if (capasGeojson[nombre]) {
    // Si ya está cargada, añadir y ocultar loader después de un pequeño delay
    setTimeout(() => {
      capasGeojson[nombre].addTo(map);
      if (nombre === 'Terreno') ocultarLoaderTerreno();
    }, 400);
    return;
  }

  const { archivo, estilo, campoPopup, usarCluster } = configuracionCapas[nombre];
  fetch(`data/${archivo}`)
    .then(res => res.json())
    .then(data => {
      geojsonOriginal[nombre] = data;
      let capa;

      if (usarCluster) {
        const cluster = L.markerClusterGroup();
        const geo = L.geoJSON(data, {
          pointToLayer: (f, latlng) => L.marker(latlng),
          onEachFeature: (f, l) => {
            let popup = "";
            for (let key in f.properties) {
              popup += `<strong>${key}:</strong> ${f.properties[key]}<br>`;
            }
            l.bindPopup(popup);
          }
        });
        geo.eachLayer(l => cluster.addLayer(l));
        capa = cluster;
      } else {
        capa = L.geoJSON(data, {
          pane: 'canvas-pane',
          renderer: L.canvas(),
          style: () => estilo,
          onEachFeature: (f, l) => {
            let popup = "";
            for (let key in f.properties) {
              popup += `<strong>${key}:</strong> ${f.properties[key]}<br>`;
            }
            l.bindPopup(popup);
          }
        });
      }

      capasGeojson[nombre] = capa;
      capa.addTo(map);
      // Ocultar loader si es Terreno
      if (nombre === 'Terreno') ocultarLoaderTerreno();
    });
});

map.on('overlayremove', e => {
  const nombre = e.name;
  if (capasGeojson[nombre]) {
    map.removeLayer(capasGeojson[nombre]);
  }
});

function cargarZona() {
  const zona = document.getElementById('zona').value;
  if (!zona) return;
  if (capaZonaActual) map.removeLayer(capaZonaActual);
  fetch(`data/manzanas_${zona}.geojson`)
    .then(res => res.json())
    .then(data => {
      capaZonaActual = L.geoJSON(data, {
        style: { color: '#3388ff', weight: 1, fillOpacity: 0.4 },
        onEachFeature: (f, l) => {
          let popup = "";
          for (let key in f.properties) {
            popup += `<strong>${key}:</strong> ${f.properties[key]}<br>`;
          }
          l.bindPopup(popup);
        }
      }).addTo(map);
      map.fitBounds(capaZonaActual.getBounds());
    });
}

function limpiarZona() {
  if (capaZonaActual) map.removeLayer(capaZonaActual);
  document.getElementById('zona').value = '';
}

// Cuando se clicke sobre un terreno que arroje información relevante
fetch('data/zonas.json')
  .then(res => res.json())
  .then(zonas => {
    const select = document.getElementById('zona');
    zonas.forEach(z => {
      const opt = document.createElement('option');
      opt.value = z;
      opt.textContent = z.replace(/_/g, ' ');
      select.appendChild(opt);
    });
  });

const camposPorCapa = {
  "Terreno": ["Numero Predial"],
  "Unidades": ["npn", "identificador"],
  "Barrios": ["PK_BARRIO"],
  "Comunas": ["COMUNA", "NOMBRE_UPZ"]
};

const aliasCampos = {
  "BARRIO": "Barrio",
  "SECTOR": "Sector",
  "npn": "Número Predial",
  "identificador": "Identificador",
  "COMUNA": "Comuna Número",
  "PK_BARRIO": "Código Barrio",
  "NOMBRE_UPZ": "Nombre UPZ",
  "NOMBRE_COM": "Nombre Comuna",
  "AREA__HAS_": "Área Comuna (Has)",
  "NOM_BARRIO": "Número Barrio",
  "MUNICIPIO": "Municipio",
  "CORREGIMIENTO": "Corregimiento"
};


// Función para generar popup personalizado
function generarPopup(feature, nombreCapa) {
  const config = configuracionCapas[nombreCapa];
  const campoPopup = config.campoPopup;
  
  // Opción 1: Solo mostrar el campo principal
  if (campoPopup && feature.properties[campoPopup]) {
    const alias = aliasCampos[campoPopup] || campoPopup;
    return `<strong>${alias}:</strong> ${feature.properties[campoPopup]}`;
  }
  
  // Opción 2: Mostrar campos específicos por capa
  const camposEspecificos = {
    "Terreno": ["id", "Numero Predial", "Area de Terreno"], // Ajusta estos campos según lo que tengas
    "Unidades": ["id", "Numero Predial","Area Construida", "Planta de ubicación","altura","Superficie"],
    "Barrios": [ "MUNICIPIO", "PK_BARRIO","NOM_BARRIO","CORREGIMIENTO"],
    "Comunas": ["COMUNA", "NOMBRE_UPZ", "NOMBRE_COM","AREA__HAS_"]
  };
  
  if (camposEspecificos[nombreCapa]) {
    let popup = "";
    camposEspecificos[nombreCapa].forEach(campo => {
      if (feature.properties[campo]) {
        const alias = aliasCampos[campo] || campo;
        popup += `<strong>${alias}:</strong> ${feature.properties[campo]}<br>`;
      }
    });
    return popup || "Sin información disponible";
  }
  
  // Fallback: mostrar todo como antes
  let popup = "";
  for (let key in feature.properties) {
    const alias = aliasCampos[key] || key;
    popup += `<strong>${alias}:</strong> ${feature.properties[key]}<br>`;
  }
  return popup;
}


function actualizarCampos() {
  const capa = document.getElementById('filtro-capa').value;
  const campoSelect = document.getElementById('filtro-campo');
  campoSelect.innerHTML = '';

  // Verifica si ya tienes geojsonOriginal cargado
  if (!geojsonOriginal[capa]) {
    const { archivo } = configuracionCapas[capa];
    fetch(`data/${archivo}`)
      .then(res => res.json())
      .then(data => {
        geojsonOriginal[capa] = data;
        completarCampos(capa);
        actualizarValores();
      });
  } else {
    completarCampos(capa);
    actualizarValores();
  }
}

function completarCampos(capa) {
  const campoSelect = document.getElementById('filtro-campo');
  campoSelect.innerHTML = '';
  (camposPorCapa[capa] || []).forEach(campo => {
    const opt = document.createElement('option');
    opt.value = campo;
    opt.textContent = aliasCampos[campo] || campo;
    campoSelect.appendChild(opt);
  });
}


function actualizarValores() {
  const capa = document.getElementById('filtro-capa').value;
  const campo = document.getElementById('filtro-campo').value;
  const lista = document.getElementById('lista-valores');
  lista.innerHTML = '';
  const valores = new Set();
  const datos = geojsonOriginal[capa]?.features || [];
  datos.forEach(f => {
    const valor = f.properties?.[campo];
    if (valor) valores.add(valor);
  });
  [...valores].sort().forEach(valor => {
    const opt = document.createElement('option');
    opt.value = valor;
    lista.appendChild(opt);
  });
}

function filtrarCapa() {
  const capaNombre = document.getElementById('filtro-capa').value;
  const campo = document.getElementById('filtro-campo').value;
  const valor = document.getElementById('filtro-valor').value.toLowerCase();
  if (!capaNombre || !campo || !valor) return;

  const base = geojsonOriginal[capaNombre]?.features || [];
  const filtradas = base.filter(f => (f.properties?.[campo] || '').toString().toLowerCase() === valor);

  if (capaFiltrada) map.removeLayer(capaFiltrada);

  capaFiltrada = L.geoJSON({ type: 'FeatureCollection', features: filtradas }, {
    style: { color: 'yellow', weight: 2, fillOpacity: 0.6 },
    onEachFeature: (feature, layer) => {
      const popup = generarPopup(feature, capaNombre);
      layer.bindPopup(popup);
    }
  }).addTo(map);

  if (filtradas.length > 0) map.fitBounds(capaFiltrada.getBounds());
  console.log(`Filtrados: ${filtradas.length}`);
}

function limpiarFiltro() {
  document.getElementById('filtro-valor').value = '';
  if (capaFiltrada) map.removeLayer(capaFiltrada);
  capaFiltrada = null;
  const comunas = geojsonOriginal["Comunas"];
  if (comunas && comunas.features && comunas.features.length > 0) {
    const capaComunas = L.geoJSON(comunas);
    map.fitBounds(capaComunas.getBounds());
    capaComunas.remove(); // Elimina la capa temporal
  } else {
    map.setZoom(13); // Fallback si no está cargada
  }
};


// Control de capas desde checkboxes del menú Gestionar Capas
function toggleCapa(nombre) {
  const checkbox = document.getElementById('capa' + nombre);
  const config = configuracionCapas[nombre];
  const geojson = geojsonOriginal[nombre];
  if (!config || !geojson) return;

  checkbox.dataset.manual = 'true';

  // Si Terreno, mostrar loader al activar
  if (nombre === 'Terreno') {
    if (checkbox.checked) {
      mostrarLoaderTerreno();
      setTimeout(() => {
        if (!capasVisibles[nombre]) {
          capasVisibles[nombre] = L.geoJSON(geojson, {
            pane: 'canvas-pane',
            renderer: L.canvas(),
            style: () => config.estilo,
            onEachFeature: (feature, layer) => {
              const popup = generarPopup(feature, nombre);
              layer.bindPopup(popup);
            }
          }).addTo(map);
        }
        ocultarLoaderTerreno();
      }, 600);
    } else {
      if (capasVisibles[nombre]) {
        map.removeLayer(capasVisibles[nombre]);
        capasVisibles[nombre] = null;
      }
      ocultarLoaderTerreno();
    }
    return;
  }

  // Para otras capas
  if (checkbox.checked) {
    if (!capasVisibles[nombre]) {
      capasVisibles[nombre] = L.geoJSON(geojson, {
        style: () => config.estilo,
        onEachFeature: (feature, layer) => {
          const popup = generarPopup(feature, nombre);
          layer.bindPopup(popup);
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


// Funciones para filtros en Offcanvas móvil
function actualizarCamposMovil() {
  const capa = document.getElementById('filtro-capa-movil').value;
  const campoSelect = document.getElementById('filtro-campo-movil');
  campoSelect.innerHTML = '';
  if (!geojsonOriginal[capa]) {
    const { archivo } = configuracionCapas[capa];
    fetch(`data/${archivo}`)
      .then(res => res.json())
      .then(data => {
        geojsonOriginal[capa] = data;
        completarCamposMovil(capa);
        actualizarValoresMovil();
      });
  } else {
    completarCamposMovil(capa);
    actualizarValoresMovil();
  }
}
function completarCamposMovil(capa) {
  const campoSelect = document.getElementById('filtro-campo-movil');
  campoSelect.innerHTML = '';
  (camposPorCapa[capa] || []).forEach(campo => {
    const opt = document.createElement('option');
    opt.value = campo;
    opt.textContent = aliasCampos[campo] || campo;
    campoSelect.appendChild(opt);
  });
}
function actualizarValoresMovil() {
  const capa = document.getElementById('filtro-capa-movil').value;
  const campo = document.getElementById('filtro-campo-movil').value;
  const lista = document.getElementById('lista-valores-movil');
  lista.innerHTML = '';
  const valores = new Set();
  const datos = geojsonOriginal[capa]?.features || [];
  datos.forEach(f => {
    const valor = f.properties?.[campo];
    if (valor) valores.add(valor);
  });
  [...valores].sort().forEach(valor => {
    const opt = document.createElement('option');
    opt.value = valor;
    lista.appendChild(opt);
  });
}
function filtrarCapaMovil() {
  const capaNombre = document.getElementById('filtro-capa-movil').value;
  const campo = document.getElementById('filtro-campo-movil').value;
  const valor = document.getElementById('filtro-valor-movil').value.toLowerCase();
  if (!capaNombre || !campo || !valor) return;
  const base = geojsonOriginal[capaNombre]?.features || [];
  const filtradas = base.filter(f => (f.properties?.[campo] || '').toString().toLowerCase() === valor);
  if (window.capaFiltradaMovil) map.removeLayer(window.capaFiltradaMovil);
  window.capaFiltradaMovil = L.geoJSON({ type: 'FeatureCollection', features: filtradas }, {
    style: { color: 'yellow', weight: 2, fillOpacity: 0.6 },
    onEachFeature: (feature, layer) => {
      const popup = generarPopup(feature, capaNombre);
      layer.bindPopup(popup);
    }
  }).addTo(map);
  if (filtradas.length > 0) map.fitBounds(window.capaFiltradaMovil.getBounds());
  console.log(`Filtrados móvil: ${filtradas.length}`);
}
function limpiarFiltroMovil() {
  document.getElementById('filtro-valor-movil').value = '';
  if (window.capaFiltradaMovil) map.removeLayer(window.capaFiltradaMovil);
  window.capaFiltradaMovil = null;
}