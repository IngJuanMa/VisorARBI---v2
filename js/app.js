// ***************************************
// Este archivo es un script antiguo que se dejó simplemnte como una especie de Backup
// *************************************** 



// const map = L.map('map').setView([2.93, -75.28], 13);
// L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
//   maxZoom: 19,
//   attribution: '&copy; OpenStreetMap contributors'
// }).addTo(map);
// L.control.scale({ position: 'bottomleft' }).addTo(map);

const callejero = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
});

const satelital = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 19,
  attribution: '&copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
});

const hibrido = L.layerGroup([
  satelital,
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    opacity: 0.3
  })
]);


const map = L.map('map', {
  center: [2.93, -75.28],
  zoom: 12,
  layers: [callejero],  // capa inicial

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

// Objeto para gestionar las capas base
const baseMaps = {
  "callejero": callejero,
  "satelital": satelital,
  "hibrido": hibrido
};

// Variable para rastrear la capa base actual
let capaBaseActual = callejero;

// Función para cambiar la capa base desde el dropdown
function cambiarMapaBase(tipoMapa) {
  // Remover la capa base actual
  if (capaBaseActual) {
    map.removeLayer(capaBaseActual);
  }

  // Añadir la nueva capa base
  capaBaseActual = baseMaps[tipoMapa];
  map.addLayer(capaBaseActual);

  // Actualizar estado visual de las capas
  actualizarEstadoVisualCapas(tipoMapa);

  console.log(`Capa base cambiada a: ${tipoMapa}`);
}

// Función para actualizar el estado visual de las capas
function actualizarEstadoVisualCapas(capaActiva) {
  // Remover clase activa de todos los articles
  document.querySelectorAll('.capa-vista').forEach(article => {
    article.classList.remove('activa');
  });

  // Añadir clase activa al article correspondiente
  const articles = document.querySelectorAll('.capa-vista');
  articles.forEach(article => {
    const onclick = article.getAttribute('onclick');
    if (onclick && onclick.includes(`'${capaActiva}'`)) {
      article.classList.add('activa');
    }
  });
}

// Inicializar el estado visual al cargar la página
document.addEventListener('DOMContentLoaded', function () {
  // Marcar la capa inicial como activa (callejero)
  actualizarEstadoVisualCapas('callejero');
});

// Hacer la función global para que funcione con onclick
window.cambiarMapaBase = cambiarMapaBase;

// Aquí puedes añadir también tus capas vectoriales si quieres mostrarlas en el control
// L.control.layers(baseMaps, null, { position: 'topright', collapsed: false }).addTo(map);
L.control.scale({ position: 'bottomleft' }).addTo(map);


let capaZonaActual = null;
let capaFiltrada = null;
const capasGeojson = {};
const geojsonOriginal = {};
// const controlCapas = L.control.layers({}, {}).addTo(map); // Desactivado por menú personalizado

const configuracionCapas = {
  "Terreno": { archivo: "terreno.geojson", estilo: { color: 'red', weight: 0.6, fillOpacity: 0.2 }, campoPopup: "uso", minZoom: 19, maxZoom: 22 },
  "Unidades": { archivo: "unidades.geojson", estilo: { color: 'purple', weight: 0.6, fillOpacity: 0.2 }, campoPopup: "estado", minZoom: 19, maxZoom: 22 },
  // "Manzanas": { archivo: "manzanas_BARRIO1.geojson", estilo: { color: 'orange' }, campoPopup: "BARRIO" },
  "Barrios": { archivo: "barrios.geojson", estilo: { color: 'green', weight: 0.6, fillOpacity: 0.2 }, campoPopup: "BARRIO", minZoom: 16, maxZoom: 18 },
  "Comunas": { archivo: "comunas.geojson", estilo: { color: 'blue', weight: 0.6, fillOpacity: 0.2 }, campoPopup: "COMUNA", minZoom: 0, maxZoom: 15 }
};

// for (const nombre in configuracionCapas) {
//   controlCapas.addOverlay(L.layerGroup(), nombre);
// }


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
  console.log(`Zoom actual: ${zoom}`);

  for (const nombre in configuracionCapas) {
    const config = configuracionCapas[nombre];
    const geojson = geojsonOriginal[nombre];
    if (!geojson) continue;
    const isVisible = zoom >= config.minZoom && zoom <= config.maxZoom;
    const checkbox = document.getElementById('capa' + nombre);
    const isChecked = checkbox && checkbox.checked;

    // Si el usuario activó la capa manualmente, la mantenemos visible siempre
    if (isChecked) {
      if (!capasVisibles[nombre]) {
        if (nombre === 'Terreno') mostrarLoaderTerreno();
        capasVisibles[nombre] = L.geoJSON(geojson, {
          style: () => config.estilo,
          onEachFeature: (feature, layer) => {
            let popup = "";
            for (let key in feature.properties) {
              popup += `<strong>${key}:</strong> ${feature.properties[key]}<br>`;
            }
            layer.bindPopup(popup);
          }
        }).addTo(map);
        if (nombre === 'Terreno') setTimeout(ocultarLoaderTerreno, 600);
        console.log(`Capa ${nombre} activada por usuario`);
      }
      // No la quitamos aunque el zoom cambie
      continue;
    }

    // Si no está activada manualmente, aplica el control automático por zoom
    if (nombre === 'Terreno') {
      if (isVisible) {
        if (!capasVisibles[nombre] && !timeoutTerreno) {
          mostrarLoaderTerreno();
          timeoutTerreno = setTimeout(() => {
            if (map.getZoom() >= config.minZoom && map.getZoom() <= config.maxZoom) {
              capasVisibles[nombre] = L.geoJSON(geojson, {
                style: () => config.estilo,
                onEachFeature: (feature, layer) => {
                  let popup = "";
                  for (let key in feature.properties) {
                    popup += `<strong>${key}:</strong> ${feature.properties[key]}<br>`;
                  }
                  layer.bindPopup(popup);
                }
              }).addTo(map);
              console.log(`Capa ${nombre} activada (zoom)`);
            }
            ocultarLoaderTerreno();
            timeoutTerreno = null;
          }, 600);
        }
      } else {
        if (timeoutTerreno) {
          clearTimeout(timeoutTerreno);
          timeoutTerreno = null;
        }
        if (capasVisibles[nombre]) {
          map.removeLayer(capasVisibles[nombre]);
          capasVisibles[nombre] = null;
          console.log(`Capa ${nombre} desactivada (zoom)`);
        }
        ocultarLoaderTerreno();
      }
    } else {
      if (isVisible) {
        if (!capasVisibles[nombre]) {
          capasVisibles[nombre] = L.geoJSON(geojson, {
            style: () => config.estilo,
            onEachFeature: (feature, layer) => {
              let popup = "";
              for (let key in feature.properties) {
                popup += `<strong>${key}:</strong> ${feature.properties[key]}<br>`;
              }
              layer.bindPopup(popup);
            }
          }).addTo(map);
          console.log(`Capa ${nombre} activada (zoom)`);
        }
      } else {
        if (capasVisibles[nombre]) {
          map.removeLayer(capasVisibles[nombre]);
          capasVisibles[nombre] = null;
          console.log(`Capa ${nombre} desactivada (zoom)`);
        }
      }
    }
  }
});



map.on('overlayadd', e => {
  const nombre = e.name;
  // Mostrar loader si es Terreno
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
  "Terreno": ["npn"],
  "Unidades": ["npn", "identificador"],
  "Barrios": ["PK_BARRIO"],
  "Comunas": ["COMUNA"]
};

const aliasCampos = {
  "BARRIO": "Barrio",
  "SECTOR": "Sector",
  "npn": "Número Predial",
  "identificador": "Identificador",
  "COMUNA": "Comuna Número",
  "PK_BARRIO": "Código Barrio"
};

// function actualizarCampos() {
//   const capa = document.getElementById('filtro-capa').value;
//   const campoSelect = document.getElementById('filtro-campo');
//   campoSelect.innerHTML = '';
//   (camposPorCapa[capa] || []).forEach(campo => {
//     const opt = document.createElement('option');
//     opt.value = campo;
//     opt.textContent = aliasCampos[campo] || campo;
//     campoSelect.appendChild(opt);
//   });
//   actualizarValores();
// }

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
      let popup = "";
      for (let key in feature.properties) {
        popup += `<strong>${key}:</strong> ${feature.properties[key]}<br>`;
      }
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

  // Si Terreno, mostrar loader al activar
  if (nombre === 'Terreno') {
    if (checkbox.checked) {
      mostrarLoaderTerreno();
      setTimeout(() => {
        if (!capasVisibles[nombre]) {
          capasVisibles[nombre] = L.geoJSON(geojson, {
            style: () => config.estilo,
            onEachFeature: (feature, layer) => {
              let popup = "";
              for (let key in feature.properties) {
                popup += `<strong>${key}:</strong> ${feature.properties[key]}<br>`;
              }
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
          let popup = "";
          for (let key in feature.properties) {
            popup += `<strong>${key}:</strong> ${feature.properties[key]}<br>`;
          }
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
      let popup = "";
      for (let key in feature.properties) {
        popup += `<strong>${key}:</strong> ${feature.properties[key]}<br>`;
      }
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