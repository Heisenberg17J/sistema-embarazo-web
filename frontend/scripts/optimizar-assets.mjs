// Genera las imágenes de marca optimizadas en public/marca a partir de los
// originales de assets-fuente/ (ignorada por git). Usa sharp, que ya viene con Next.
//
//   node scripts/optimizar-assets.mjs [carpeta-de-originales]
//
// Los nombres llevan un sufijo de versión (.v1) para cachearlos como inmutables:
// si cambia una imagen, se sube la versión en lugar de reutilizar el nombre.
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const raiz = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const fuente = path.resolve(process.argv[2] ?? path.join(raiz, "assets-fuente"));
const destino = path.join(raiz, "public", "marca");
const VERSION = "v1";

// Límites del plan de rendimiento, en KB, para la variante AVIF más grande.
const LIMITES = { fondo: 60, patron: 25, ilustracion: 40 };

const resultados = [];

async function guardar(imagen, nombre, limite) {
  for (const [formato, opciones] of [
    ["avif", { quality: 50, effort: 6 }],
    ["webp", { quality: 72, effort: 6 }],
  ]) {
    const archivo = path.join(destino, `${nombre}.${VERSION}.${formato}`);
    await imagen.clone()[formato](opciones).toFile(archivo);
    const kb = (await stat(archivo)).size / 1024;
    resultados.push({ archivo: path.basename(archivo), kb, limite: formato === "avif" ? limite : null });
  }
}

async function fondos() {
  const mapa = [
    ["fondo_card1.jpg", "fondo-ondas"],
    ["fondo_card2.jpg", "fondo-colinas"],
    ["fond_card3.jpg", "fondo-linea"],
  ];
  for (const [original, nombre] of mapa) {
    for (const ancho of [640, 1280]) {
      const imagen = sharp(path.join(fuente, original)).resize({ width: ancho });
      await guardar(imagen, `${nombre}-${ancho}`, LIMITES.fondo);
    }
  }
}

// El patrón se repite cada 688 px en horizontal (medido por autocorrelación) y
// casi cada 768 px en vertical; con la opacidad tan baja a la que se usa, la
// pequeña diferencia de la costura vertical no se percibe.
async function patron() {
  const imagen = sharp(path.join(fuente, "fondo_patron.jpg"))
    .extract({ left: 0, top: 0, width: 688, height: 768 })
    .resize({ width: 512 });
  await guardar(imagen, "patron", LIMITES.patron);
}

// La ilustración se recorta del banner sin el texto incrustado y se le quita el
// fondo lavanda para que se apoye sobre cualquier superficie. El fondo es frío y
// claro; la piel y la ropa se separan de él por tono, así que basta un recorte
// por distancia de color con un borde suave.
async function ilustracion() {
  const recorte = sharp(path.join(fuente, "banner.jpg")).extract({ left: 120, top: 40, width: 920, height: 1144 });
  const { data, info } = await recorte.clone().removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  // Color del fondo, muestreado en las esquinas superiores del recorte.
  const muestra = (x, y) => {
    const i = (y * width + x) * 3;
    return [data[i], data[i + 1], data[i + 2]];
  };
  const esquinas = [muestra(4, 4), muestra(width - 5, 4), muestra(4, Math.floor(height / 2))];
  const fondo = [0, 1, 2].map((c) => esquinas.reduce((s, m) => s + m[c], 0) / esquinas.length);
  const alfa = Buffer.alloc(width * height);
  for (let p = 0; p < width * height; p++) {
    const i = p * 3;
    const d = Math.hypot(data[i] - fondo[0], data[i + 1] - fondo[1], data[i + 2] - fondo[2]);
    // 0 junto al color del fondo, opaco a partir de una distancia de 34.
    alfa[p] = Math.max(0, Math.min(255, Math.round(((d - 12) / 22) * 255)));
  }
  // Los iconos sueltos del banner (nube, caballito, huellas, sonajero, puntos)
  // rodean a la figura; se borran para quedarse solo con la mujer y las plantas.
  const borrar = [
    [0, 0, 150, 170], // nube y punto superior izquierdo
    [0, 150, 70, 1144], // sonajero y biberón del borde izquierdo
    [690, 0, 920, 590], // corazón, caballito y huellas
    [190, 15, 250, 75], // punto sobre el pelo
    [640, 0, 690, 90], // resto del corazón
    [125, 210, 185, 270], // punto junto al pelo
  ];
  for (const [x0, y0, x1, y1] of borrar) {
    for (let y = y0; y < Math.min(y1, height); y++) alfa.fill(0, y * width + x0, y * width + Math.min(x1, width));
  }
  // Se materializa en PNG antes de redimensionar: sobre la entrada cruda con el
  // canal añadido, sharp no conserva la proporción.
  const png = await sharp(data, { raw: { width, height, channels: 3 } })
    .joinChannel(alfa, { raw: { width, height, channels: 1 } })
    .png()
    .toBuffer();
  await guardar(sharp(png).resize({ width: 560 }), "ilustracion-gestante", LIMITES.ilustracion);
}

await mkdir(destino, { recursive: true });
await fondos();
await patron();
await ilustracion();

let excedido = false;
for (const { archivo, kb, limite } of resultados) {
  const marca = limite && kb > limite ? `  ⚠ supera ${limite} KB` : "";
  if (marca) excedido = true;
  console.log(`${archivo.padEnd(36)} ${kb.toFixed(1).padStart(6)} KB${marca}`);
}
if (excedido) process.exitCode = 1;
