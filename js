// script.js

(() => {
  "use strict";

  // ==================================================
  // 1. Declaración de Constantes y Variables Globales
  // ==================================================

  const PARAMETROS = {
    explosivePerMeter: 3.14, // kg/m
    drillingTimePerMeter: 7, // min/m
    depth: 12, // m
    setUpTimePerHole: 3, // min
    areaWidth: 30, // Ancho del área en metros
    areaLength: 60, // Largo del área en metros
    drillingCostPerMinute: 0.75, // Costo de perforación por minuto
  };

  const KbValues = {
    ANFO: { Blanda: 20, Media: 25, Dura: 30 },
    Emulsión: { Blanda: 22, Media: 27, Dura: 32 },
    Gelatina: { Blanda: 24, Media: 29, Dura: 34 },
  };

  const densidadRocaValues = {
    Blanda: 2.2, // t/m³
    Media: 2.5,
    Dura: 2.7,
  };

  const costosExplosivos = {
    ANFO: 2.0, // Costo por kg en dólares
    Emulsión: 3.5,
    Gelatina: 5.0,
  };

  // Variables para Three.js
  let scene, camera, renderer, controls;
  let holes = [];

  // Variable para escenarios guardados
  let savedScenarios = [];

  // ==================================================
  // 2. Inicialización al Cargar el DOM
  // ==================================================

  document.addEventListener("DOMContentLoaded", () => {
    setupEventListeners();
    init3DScene();
  });

  // ==================================================
  // 3. Inicialización de la Escena 3D
  // ==================================================

  function init3DScene() {
    // Configuración básica de la escena
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xe0e0e0);

    // Configuración de la cámara
    const canvasContainer = document.getElementById("visualization");
    const width = canvasContainer.clientWidth;
    const height = 600; // Altura fija para la visualización
    camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(PARAMETROS.areaWidth, 50, PARAMETROS.areaLength);

    // Configuración del renderizador
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);

    // Añadir el canvas al contenedor correspondiente
    canvasContainer.appendChild(renderer.domElement);

    // Controles de órbita
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; // Suavizar los movimientos
    controls.dampingFactor = 0.05;
    controls.update();

    // Configuración de luces
    setupLights();

    // Creación del plano base
    createPlane();

    // Manejo de redimensionamiento de la ventana
    window.addEventListener("resize", onWindowResize);

    // Iniciar la animación
    animate();
  }

  // Configuración de luces
  function setupLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 100, 50);
    scene.add(directionalLight);
  }

  // Creación del plano base (representa la superficie de la mina)
  function createPlane() {
    const planeGeometry = new THREE.PlaneGeometry(
      PARAMETROS.areaWidth,
      PARAMETROS.areaLength
    );
    const planeMaterial = new THREE.MeshStandardMaterial({
      color: 0xcccccc,
      side: THREE.DoubleSide,
    });

    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = -Math.PI / 2; // Girar para que sea horizontal
    plane.receiveShadow = true;
    scene.add(plane);
  }

  // ==================================================
  // 4. Configuración de los Event Listeners
  // ==================================================

  function setupEventListeners() {
    const form = document.getElementById("drillingParameters");
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      visualize();
    });

    form.addEventListener("reset", resetParams);

    document
      .getElementById("exportCSV")
      .addEventListener("click", exportToExcel);

    document
      .getElementById("compareScenarios")
      .addEventListener("click", compararEscenarios);
  }

  // ==================================================
  // 5. Función Principal para Visualizar los Resultados
  // ==================================================

  function visualize() {
    // Obtener y validar los parámetros ingresados
    const tipoExplosivo = document.getElementById("tipoExplosivo").value;
    const tipoRoca = document.getElementById("tipoRoca").value;
    const diametroTaladroStr = document.getElementById("diametroTaladro").value;

    if (!tipoExplosivo || !tipoRoca || !diametroTaladroStr) {
      showMessage("Por favor, complete todos los parámetros.", "error");
      return;
    }

    const diametroTaladro = parseFloat(diametroTaladroStr);
    if (isNaN(diametroTaladro) || diametroTaladro <= 0) {
      showMessage(
        "Por favor, ingrese un diámetro del taladro válido (número positivo).",
        "error"
      );
      return;
    }

    // Parámetros utilizados
    const parametros = {
      tipoExplosivo,
      tipoRoca,
      diametroTaladro,
    };

    // Realizar los cálculos y actualizar la interfaz
    try {
      const resultados = calcularResultados(
        tipoExplosivo,
        tipoRoca,
        diametroTaladro
      );
      actualizarResultados(resultados);
      generarPozos(resultados);

      // Guardar el escenario actual
      saveScenario(resultados, parametros);

      showMessage("Resultados actualizados y escenario guardado.", "success");
    } catch (error) {
      showMessage(
        "Ocurrió un error durante el proceso de cálculo. Por favor revise los parámetros ingresados.",
        "error"
      );
      console.error(error);
    }
  }

  // ==================================================
  // 6. Función para Calcular los Resultados
  // ==================================================

  function calcularResultados(tipoExplosivo, tipoRoca, diametroTaladro) {
    const diametroTaladro_m = diametroTaladro / 1000; // Convertir a metros

    // Validación de datos
    if (!KbValues[tipoExplosivo] || !KbValues[tipoExplosivo][tipoRoca]) {
      throw new Error("Combinación de explosivo y roca inválida.");
    }

    const Kb = KbValues[tipoExplosivo][tipoRoca];
    const densidadRoca = densidadRocaValues[tipoRoca];

    const burden = Kb * diametroTaladro_m;
    const espaciamiento = burden * 1.2;
    const volumenPozo = burden * espaciamiento * PARAMETROS.depth;

    const explosivePerPozo =
      PARAMETROS.depth * diametroTaladro_m * PARAMETROS.explosivePerMeter;
    const totalHoles = calcularNumeroDePozos(burden, espaciamiento);

    const totalExplosive = explosivePerPozo * totalHoles;
    const toneladasPerforadas = totalHoles * volumenPozo * densidadRoca;

    const tiempoPorPozo =
      PARAMETROS.depth * PARAMETROS.drillingTimePerMeter +
      PARAMETROS.setUpTimePerHole;
    const totalDrillingTime = tiempoPorPozo * totalHoles;

    // Cálculo de costos

    // Costo de perforación por pozo
    const costoPerforacionPorPozo =
      (PARAMETROS.depth * PARAMETROS.drillingTimePerMeter +
        PARAMETROS.setUpTimePerHole) *
      PARAMETROS.drillingCostPerMinute;

    const costoPerforacionTotal = costoPerforacionPorPozo * totalHoles;

    // Costo del explosivo
    const costoExplosivoPorKg = costosExplosivos[tipoExplosivo] || 0;
    const costoExplosivo = totalExplosive * costoExplosivoPorKg;

    // Costo total
    const costoTotal = costoPerforacionTotal + costoExplosivo;

    // Retornar un objeto con todos los resultados
    return {
      burden,
      espaciamiento,
      volumenPozo,
      explosivePerPozo,
      totalHoles,
      totalExplosive,
      toneladasPerforadas,
      totalDrillingTime,
      costoPerforacionTotal,
      costoExplosivo,
      costoTotal,
    };
  }

  // ==================================================
  // 7. Función para Calcular el Número de Pozos
  // ==================================================

  function calcularNumeroDePozos(burden, espaciamiento) {
    const areaTotal = PARAMETROS.areaWidth * PARAMETROS.areaLength; // Área total de la mina
    const areaPozo = burden * espaciamiento;
    const totalHoles = Math.floor(areaTotal / areaPozo);
    if (totalHoles <= 0) {
      throw new Error("No se pueden generar pozos con los parámetros dados.");
    }
    return totalHoles;
  }

  // ==================================================
  // 8. Función para Actualizar los Resultados en la Interfaz
  // ==================================================

  function actualizarResultados(resultados) {
    document.getElementById(
      "totalExplosive"
    ).innerText = `${resultados.totalExplosive.toFixed(2)} kg`;
    document.getElementById("totalDrillingTime").innerText = `${(
      resultados.totalDrillingTime / 60
    ).toFixed(2)} h`;
    document.getElementById(
      "toneladasPerforadas"
    ).innerText = `${resultados.toneladasPerforadas.toFixed(2)} t`;
    document.getElementById(
      "result-burden"
    ).innerText = `${resultados.burden.toFixed(2)} m`;
    document.getElementById(
      "result-spacing"
    ).innerText = `${resultados.espaciamiento.toFixed(2)} m`;
    document.getElementById(
      "result-volumenPozo"
    ).innerText = `${resultados.volumenPozo.toFixed(2)} m³`;
    document.getElementById(
      "result-explosivePerPozo"
    ).innerText = `${resultados.explosivePerPozo.toFixed(2)} kg`;
    document.getElementById(
      "totalHoles"
    ).innerText = `${resultados.totalHoles}`;

    // Actualizar costos con formato de moneda
    document.getElementById("result-costoPerforacion").innerText =
      formatoMoneda(resultados.costoPerforacionTotal);
    document.getElementById("result-costoExplosivo").innerText = formatoMoneda(
      resultados.costoExplosivo
    );
    document.getElementById("result-costoTotal").innerText = formatoMoneda(
      resultados.costoTotal
    );
  }

  // Función para formatear números como moneda
  function formatoMoneda(valor) {
    return valor.toLocaleString("es-ES", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    });
  }

  // ==================================================
  // 9. Función para Generar los Pozos en la Escena 3D
  // ==================================================

  function generarPozos(resultados) {
    // Limpiar los pozos existentes
    holes.forEach((hole) => {
      scene.remove(hole);
      hole.geometry.dispose();
      hole.material.dispose();
    });
    holes = [];

    const { burden, espaciamiento } = resultados;
    const rows = Math.floor(PARAMETROS.areaLength / burden);
    const cols = Math.floor(PARAMETROS.areaWidth / espaciamiento);

    const holeRadius = 0.5; // Radio visual del pozo en metros
    const holeGeometry = new THREE.CylinderGeometry(
      holeRadius,
      holeRadius,
      PARAMETROS.depth,
      16
    );
    const holeMaterial = new THREE.MeshStandardMaterial({ color: 0x0000ff });

    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const xOffset =
          i * espaciamiento - (cols * espaciamiento) / 2 + espaciamiento / 2;
        const zOffset = j * burden - (rows * burden) / 2 + burden / 2;

        const holeMesh = new THREE.Mesh(holeGeometry, holeMaterial);
        holeMesh.position.set(xOffset, PARAMETROS.depth / 2, zOffset);
        scene.add(holeMesh);
        holes.push(holeMesh);
      }
    }
  }

  // ==================================================
  // 10. Función para Guardar Escenarios
  // ==================================================

  function saveScenario(resultados, parametros) {
    const escenario = {
      id: Date.now(),
      parametros,
      resultados,
    };

    savedScenarios.push(escenario);
    actualizarListaEscenarios();
  }

  // ==================================================
  // 11. Función para Actualizar la Lista de Escenarios
  // ==================================================

  function actualizarListaEscenarios() {
    const listaEscenarios = document.getElementById("listaEscenarios");
    listaEscenarios.innerHTML = "";

    savedScenarios.forEach((escenario) => {
      const item = document.createElement("div");
      item.className = "scenario-item";

      item.innerHTML = `
        <input type="checkbox" class="scenario-checkbox" data-id="${escenario.id}" />
        <span>Explosivo: ${escenario.parametros.tipoExplosivo}, Roca: ${escenario.parametros.tipoRoca}, Diámetro: ${escenario.parametros.diametroTaladro} mm</span>
      `;

      listaEscenarios.appendChild(item);
    });
  }

  // ==================================================
  // 12. Función para Comparar Escenarios
  // ==================================================

  function compararEscenarios() {
    const checkboxes = document.querySelectorAll(".scenario-checkbox:checked");
    if (checkboxes.length < 2) {
      showMessage("Seleccione al menos dos escenarios para comparar.", "error");
      return;
    }

    const escenariosSeleccionados = [];
    checkboxes.forEach((checkbox) => {
      const id = parseInt(checkbox.getAttribute("data-id"), 10);
      const escenario = savedScenarios.find((e) => e.id === id);
      if (escenario) {
        escenariosSeleccionados.push(escenario);
      }
    });

    mostrarTablaComparativa(escenariosSeleccionados);
  }

  // ==================================================
  // 13. Función para Mostrar la Tabla Comparativa
  // ==================================================

  function mostrarTablaComparativa(escenarios) {
    const tablaComparacion = document.getElementById("tablaComparacion");
    tablaComparacion.innerHTML = "";

    const headers = ["Parámetro/Resultado"];
    escenarios.forEach((escenario, index) => {
      headers.push(`Escenario ${index + 1}`);
    });

    const headerRow = document.createElement("tr");
    headers.forEach((header) => {
      const th = document.createElement("th");
      th.textContent = header;
      headerRow.appendChild(th);
    });
    tablaComparacion.appendChild(headerRow);

    const campos = [
      { label: "Tipo de Explosivo", key: "tipoExplosivo", isParam: true },
      { label: "Tipo de Roca", key: "tipoRoca", isParam: true },
      {
        label: "Diámetro del Taladro (mm)",
        key: "diametroTaladro",
        isParam: true,
      },
      { label: "Total de Explosivo (kg)", key: "totalExplosive" },
      { label: "Tiempo Total de Perforación (h)", key: "totalDrillingTime" },
      {
        label: "Toneladas Métricas Perforadas (t)",
        key: "toneladasPerforadas",
      },
      { label: "Burden (m)", key: "burden" },
      { label: "Espaciamiento (m)", key: "espaciamiento" },
      { label: "Volumen por Pozo (m³)", key: "volumenPozo" },
      { label: "Explosivo por Pozo (kg)", key: "explosivePerPozo" },
      { label: "Número Total de Pozos", key: "totalHoles" },
      {
        label: "Costo de Perforación",
        key: "costoPerforacionTotal",
        isCurrency: true,
      },
      { label: "Costo del Explosivo", key: "costoExplosivo", isCurrency: true },
      { label: "Costo Total", key: "costoTotal", isCurrency: true },
    ];

    campos.forEach((campo) => {
      const row = document.createElement("tr");

      const cellLabel = document.createElement("td");
      cellLabel.textContent = campo.label;
      row.appendChild(cellLabel);

      escenarios.forEach((escenario) => {
        const cellValue = document.createElement("td");
        let valor;

        if (campo.isParam) {
          valor = escenario.parametros[campo.key];
        } else {
          valor = escenario.resultados[campo.key];
          if (typeof valor === "number") {
            valor = parseFloat(valor.toFixed(2));
          }
          if (campo.key === "totalDrillingTime") {
            valor = parseFloat((valor / 60).toFixed(2)); // Convertir minutos a horas
          }
          if (campo.isCurrency) {
            valor = formatoMoneda(parseFloat(valor));
          }
        }

        cellValue.textContent = valor;
        row.appendChild(cellValue);
      });

      tablaComparacion.appendChild(row);
    });
  }

  // ==================================================
  // 14. Función para Mostrar Mensajes al Usuario
  // ==================================================

  function showMessage(message, type) {
    const messageBox = document.getElementById("messageBox");
    messageBox.innerText = message;
    messageBox.className = `message-box ${type}`;
    messageBox.style.display = "block";
    setTimeout(() => {
      messageBox.style.display = "none";
    }, 5000);
  }

  // ==================================================
  // 15. Función para Restablecer los Parámetros
  // ==================================================

  function resetParams() {
    // Limpiar los resultados
    document.getElementById("totalExplosive").innerText = "0 kg";
    document.getElementById("totalDrillingTime").innerText = "0 h";
    document.getElementById("toneladasPerforadas").innerText = "0 t";
    document.getElementById("result-burden").innerText = "0 m";
    document.getElementById("result-spacing").innerText = "0 m";
    document.getElementById("result-volumenPozo").innerText = "0 m³";
    document.getElementById("result-explosivePerPozo").innerText = "0 kg";
    document.getElementById("totalHoles").innerText = "0";

    document.getElementById("result-costoPerforacion").innerText = "$0.00";
    document.getElementById("result-costoExplosivo").innerText = "$0.00";
    document.getElementById("result-costoTotal").innerText = "$0.00";

    // Limpiar la escena 3D
    holes.forEach((hole) => {
      scene.remove(hole);
      hole.geometry.dispose();
      hole.material.dispose();
    });
    holes = [];

    // Limpiar la lista de escenarios guardados
    savedScenarios = [];
    actualizarListaEscenarios();

    // Limpiar la tabla de comparación
    const tablaComparacion = document.getElementById("tablaComparacion");
    tablaComparacion.innerHTML = "";

    showMessage("Parámetros y escenarios restablecidos.", "info");
  }

  // ==================================================
  // 16. Función para Exportar los Resultados a Excel
  // ==================================================

  function exportToExcel() {
    const workbook = XLSX.utils.book_new();
    const worksheetData = [
      ["Parámetro", "Valor"],
      [
        "Total de Explosivo (kg)",
        document.getElementById("totalExplosive").innerText,
      ],
      [
        "Tiempo Total de Perforación (h)",
        document.getElementById("totalDrillingTime").innerText,
      ],
      [
        "Toneladas Métricas Perforadas (t)",
        document.getElementById("toneladasPerforadas").innerText,
      ],
      ["Burden (m)", document.getElementById("result-burden").innerText],
      [
        "Espaciamiento (m)",
        document.getElementById("result-spacing").innerText,
      ],
      [
        "Volumen por Pozo (m³)",
        document.getElementById("result-volumenPozo").innerText,
      ],
      [
        "Explosivo por Pozo (kg)",
        document.getElementById("result-explosivePerPozo").innerText,
      ],
      [
        "Número Total de Pozos",
        document.getElementById("totalHoles").innerText,
      ],
      [
        "Costo de Perforación",
        document.getElementById("result-costoPerforacion").innerText,
      ],
      [
        "Costo del Explosivo",
        document.getElementById("result-costoExplosivo").innerText,
      ],
      ["Costo Total", document.getElementById("result-costoTotal").innerText],
    ];
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Resultados");
    XLSX.writeFile(workbook, "ResultadosPerforacion.xlsx");
  }

  // ==================================================
  // 17. Función para Manejar el Redimensionamiento de la Ventana
  // ==================================================

  function onWindowResize() {
    const canvasContainer = document.getElementById("visualization");
    const width = canvasContainer.clientWidth;
    const height = 600; // Mantener la altura fija

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  // ==================================================
  // 18. Función de Animación de Three.js
  // ==================================================

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }

  // ==================================================
  // Fin del Código
  // ==================================================
})();
