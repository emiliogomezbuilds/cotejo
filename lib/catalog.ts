// The evidence catalog. Condition 1 of the Team 8 Blueprint, enforced in code:
// every requirement carries the vendor's exact words (quote), the URL and the date it was read.
// scripts/verify.ts fails the build if any entry lacks one. The model can never edit this file;
// corrections arrive as reports and are fixed by a reviewed commit, which bumps CATALOG_VERSION.
import type { Arch, OsKey, Platform } from "@/lib/specs";

export const CATALOG_VERSION = "2026-10-18.1";
const RETRIEVED = "2026-10-18";

export type Verdict = "meets" | "does_not_meet" | "cannot_decide";
export type Reason = "ok" | "below_minimum" | "below_recommended" | "not_supported" | "missing_input" | "no_rule" | "not_listed";
type MapEntry = { state: Verdict; reason?: Reason; note?: string; quote?: string };

export type Rule =
  | { kind: "os_map"; map: Partial<Record<OsKey, MapEntry>> }
  | { kind: "mac_versions"; min: number; max?: number }
  | { kind: "win11_build"; need: string }
  | { kind: "arch_map"; map: Partial<Record<Arch, MapEntry & { caveat?: string }>> }
  | { kind: "min_number"; field: "ramGb" | "storageGb"; value: number; unit: string; armValue?: number; whenArch?: Arch; note?: string; quoteHas?: string }
  | { kind: "gpu"; minVramGb: number; alsoNeeds?: string }
  | { kind: "no_rule"; why: string };

export type Req = {
  id: string;
  software: string;
  platform: Platform;
  label: string; // Spanish label shown to the student
  level: "minimum" | "recommended";
  rule: Rule;
  quote: string; // the vendor's own words (kept in the vendor's language)
  url: string;
  retrieved: string;
};

export const SOFTWARE = [
  { id: "autocad", name: "AutoCAD 2026", vendor: "Autodesk" },
  { id: "matlab", name: "MATLAB R2026b", vendor: "MathWorks" },
  { id: "solidworks", name: "SOLIDWORKS 2026-2027", vendor: "Dassault Systèmes" },
  { id: "premiere", name: "Adobe Premiere (versiones 26.x)", vendor: "Adobe" },
  { id: "vs2022", name: "Visual Studio 2022", vendor: "Microsoft" },
] as const;
export type SoftwareId = (typeof SOFTWARE)[number]["id"];
export const SOFTWARE_IDS = SOFTWARE.map((s) => s.id) as readonly SoftwareId[];

const U = {
  autocad: "https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/System-requirements-for-AutoCAD-2026-including-Specialized-Toolsets.html",
  matlab: "https://www.mathworks.com/support/requirements/matlab-system-requirements.html",
  sw: "https://www.solidworks.com/support/system-requirements",
  swGpu: "https://www.solidworks.com/support/hardware-certification",
  premiere: "https://helpx.adobe.com/premiere/desktop/get-started/technical-requirements/adobe-premiere-pro-technical-requirements.html",
  vs: "https://learn.microsoft.com/en-us/visualstudio/releases/2022/system-requirements",
};

const r = (id: string, software: SoftwareId, platform: Platform, label: string, level: Req["level"], rule: Rule, quote: string, url: string): Req =>
  ({ id, software, platform, label, level, rule, quote, url, retrieved: RETRIEVED });

export const CATALOG: Req[] = [
  // ------------------------------------------------------------------ AutoCAD 2026
  r("autocad.win.os", "autocad", "windows", "Sistema operativo", "minimum", {
    kind: "os_map", map: {
      win11_home: { state: "meets", note: "La página no distingue ediciones de Windows." },
      win11_pro: { state: "meets" },
      win10: { state: "meets" },
    },
  }, "64-bit Microsoft Windows 11 and Windows 10", U.autocad),
  r("autocad.win.cpu", "autocad", "windows", "Procesador", "minimum", {
    kind: "no_rule", why: "Pide 8 núcleos lógicos y 2.5-2.9 GHz. Para compararlo hace falta el modelo del procesador y Cotejo no tiene una base de procesadores. La página tampoco menciona procesadores ARM.",
  }, "Basic: 2.5-2.9 GHz processor with 8 logical cores (base)", U.autocad),
  r("autocad.win.ram.min", "autocad", "windows", "Memoria RAM", "minimum", { kind: "min_number", field: "ramGb", value: 8, unit: "GB" }, "Memory Basic: 8 GB", U.autocad),
  r("autocad.win.ram.rec", "autocad", "windows", "Memoria RAM", "recommended", { kind: "min_number", field: "ramGb", value: 32, unit: "GB" }, "Recommended: 32 GB", U.autocad),
  r("autocad.win.gpu.min", "autocad", "windows", "Tarjeta gráfica", "minimum", { kind: "gpu", minVramGb: 2, alsoNeeds: "29 GB/s de ancho de banda y DirectX 11" },
    "Basic: 2 GB GPU with 29 GB/s Bandwidth and DirectX 11 compliant", U.autocad),
  r("autocad.win.storage", "autocad", "windows", "Almacenamiento", "minimum",
    { kind: "min_number", field: "storageGb", value: 10, unit: "GB", note: "Es la capacidad total, no el espacio libre.", quoteHas: "10.0 GB" }, "Disk Space 10.0 GB (suggested SSD)", U.autocad),

  r("autocad.mac.os", "autocad", "macos", "Versión de macOS", "minimum", { kind: "mac_versions", min: 13, max: 26 },
    "Apple macOS Tahoe v26 (requires Update 2026.1), Apple macOS Sequoia v15, Apple macOS Sonoma v14, Apple macOS Ventura v13", U.autocad),
  r("autocad.mac.arch", "autocad", "macos", "Procesador (tipo)", "minimum", {
    kind: "arch_map", map: { x86_64: { state: "meets" }, arm: { state: "meets", note: "Apple serie M." } },
  }, "CPU Type 64-bit Intel CPU; Apple M series CPU", U.autocad),
  r("autocad.mac.ram.min", "autocad", "macos", "Memoria RAM", "minimum", { kind: "min_number", field: "ramGb", value: 8, unit: "GB" }, "Memory Basic: 8 GB", U.autocad),
  r("autocad.mac.ram.rec", "autocad", "macos", "Memoria RAM", "recommended", { kind: "min_number", field: "ramGb", value: 16, unit: "GB" }, "Recommended: 16 GB or higher", U.autocad),
  r("autocad.mac.storage", "autocad", "macos", "Almacenamiento", "minimum",
    { kind: "min_number", field: "storageGb", value: 8, unit: "GB", note: "Es la capacidad total, no el espacio libre." }, "Disk Space 8 GB free disk space for download and installation", U.autocad),

  // ------------------------------------------------------------------ MATLAB R2026b (Windows only loaded)
  r("matlab.win.os", "matlab", "windows", "Sistema operativo", "minimum", {
    kind: "os_map", map: {
      win11_home: { state: "meets", note: "La página no distingue ediciones de Windows." },
      win11_pro: { state: "meets" },
      win10: { state: "cannot_decide", reason: "missing_input", note: "El fabricante lista Windows 10 solo en la versión 22H2 y Cotejo no sabe cuál tienes." },
    },
  }, "Windows 11 (versions 24H2 and 25H2); Windows 10 (version 22H2)", U.matlab),
  r("matlab.win.build", "matlab", "windows", "Versión de Windows 11", "minimum", { kind: "win11_build", need: "24H2 o 25H2" },
    "Windows 11 (versions 24H2 and 25H2)", U.matlab),
  r("matlab.win.arch", "matlab", "windows", "Procesador (tipo)", "minimum", {
    kind: "arch_map", map: {
      x86_64: { state: "meets", note: "Cualquier procesador Intel o AMD x86-64." },
      arm: { state: "cannot_decide", reason: "no_rule", note: "Solo aparecen chips Qualcomm Snapdragon X y MATLAB corre en emulación; algunas funciones no están soportadas.", quote: "Minimum: Any Qualcomm Snapdragon X series chip; Note: On Windows ARM devices, MATLAB runs in Prism emulation" },
    },
  }, "Minimum: Any Intel or AMD x86-64 processor", U.matlab),
  r("matlab.win.cpu.rec", "matlab", "windows", "Procesador", "recommended", {
    kind: "no_rule", why: "Recomienda cuatro núcleos lógicos y soporte AVX2; hace falta el modelo del procesador y Cotejo no tiene base de procesadores.",
  }, "Recommended: Any Intel or AMD x86-64 processor with four logical cores and AVX2 instruction set support", U.matlab),
  r("matlab.win.ram.min", "matlab", "windows", "Memoria RAM", "minimum", { kind: "min_number", field: "ramGb", value: 8, unit: "GB" }, "RAM Minimum: 8 GB", U.matlab),
  r("matlab.win.ram.rec", "matlab", "windows", "Memoria RAM", "recommended", { kind: "min_number", field: "ramGb", value: 16, unit: "GB" }, "Recommended: 16 GB", U.matlab),
  r("matlab.win.storage", "matlab", "windows", "Almacenamiento", "minimum",
    { kind: "min_number", field: "storageGb", value: 4.6, unit: "GB", note: "Es solo MATLAB; una instalación típica pide 5-8 GB. Es la capacidad total, no el espacio libre." }, "Storage 4.6 GB for just MATLAB; 5-8 GB for a typical installation", U.matlab),
  r("matlab.win.gpu.rec", "matlab", "windows", "Tarjeta gráfica", "recommended", { kind: "gpu", minVramGb: 2, alsoNeeds: "compatibilidad con WebGL 2.0" },
    "A GPU supporting WebGL 2.0 with at least 2 GB of memory is recommended", U.matlab),

  // ------------------------------------------------------------------ SOLIDWORKS 2026-2027 (Windows client; Mac not listed)
  r("solidworks.win.os", "solidworks", "windows", "Sistema operativo", "minimum", {
    kind: "os_map", map: {
      win11_home: { state: "does_not_meet", reason: "not_supported", note: "Las ediciones Windows Home no están soportadas.", quote: "Windows Home Editions and Windows To Go are not supported." },
      win11_pro: { state: "meets", quote: "Windows 11, 64-bit" },
      win10: { state: "does_not_meet", reason: "not_supported", note: "Windows 10 dejó de estar soportado con SOLIDWORKS 2025 SP5; las versiones posteriores no lo soportan.", quote: "Windows 10, 64-bit: Start of Support SW 2015 SP5, End of Support SW 2025 SP5; SOLIDWORKS releases after the EOS are not supported for the said Microsoft product" },
    },
  }, "Windows 11, 64-bit", U.sw),
  r("solidworks.win.arch", "solidworks", "windows", "Procesador (tipo)", "minimum", {
    kind: "arch_map", map: {
      x86_64: { state: "meets" },
      arm: { state: "does_not_meet", reason: "not_supported", note: "El procesador debe ser x86_64 (Intel o AMD)." },
    },
  }, "Processor x86_64 (Intel 64 or AMD64)", U.sw),
  r("solidworks.win.ram.min", "solidworks", "windows", "Memoria RAM", "minimum", { kind: "min_number", field: "ramGb", value: 16, unit: "GB" }, "RAM 16 GB (32 GB recommended)", U.sw),
  r("solidworks.win.ram.rec", "solidworks", "windows", "Memoria RAM", "recommended", { kind: "min_number", field: "ramGb", value: 32, unit: "GB" }, "RAM 16 GB (32 GB recommended)", U.sw),
  r("solidworks.win.gpu", "solidworks", "windows", "Tarjeta gráfica", "minimum", {
    kind: "no_rule", why: "El fabricante solo acepta tarjetas certificadas y drivers específicos; no hay una regla numérica. Consulta su lista de hardware certificado.",
  }, "Graphics / GPU: Certified cards and drivers", U.swGpu),
  r("solidworks.mac.os", "solidworks", "macos", "Sistema operativo", "minimum", {
    kind: "os_map", map: {
      macos: { state: "cannot_decide", reason: "not_listed", note: "La página lista SOLIDWORKS solo para Windows; macOS aparece únicamente para el visor eDrawings. Tampoco soporta Macs con Windows mediante Boot Camp.", quote: "eDrawings for Mac: macOS Tahoe (26.0) ...; Apple Mac machines running Windows using Boot Camp are not supported." },
    },
  }, "Client Products (e.g. SOLIDWORKS): Windows 11, 64-bit; Windows 10, 64-bit", U.sw),

  // ------------------------------------------------------------------ Adobe Premiere 26.x
  r("premiere.win.os", "premiere", "windows", "Sistema operativo", "minimum", {
    kind: "os_map", map: {
      win11_home: { state: "meets", note: "La página no distingue ediciones; exige la actualización 24H2 (se revisa aparte)." },
      win11_pro: { state: "meets", note: "Exige la actualización 24H2 (se revisa aparte)." },
      win10: { state: "does_not_meet", reason: "not_supported", note: "Pide Windows 11 versión 24H2." },
    },
  }, "Operating system Windows 11 v24H2", U.premiere),
  r("premiere.win.build", "premiere", "windows", "Versión de Windows 11", "minimum", { kind: "win11_build", need: "24H2 o más nueva" }, "Operating system Windows 11 v24H2", U.premiere),
  r("premiere.win.cpu", "premiere", "windows", "Procesador", "minimum", {
    kind: "no_rule", why: "Pide Intel de 6.ª generación o AMD Ryzen serie 1000 o más nuevo, con AVX2 (en ARM, un Snapdragon X). Hace falta el modelo exacto y Cotejo no tiene base de procesadores.",
  }, "Intel 6th Generation or newer CPU - or AMD Ryzen 1000 Series or newer CPU; Advanced Vector Extensions 2 (AVX2) Support required; Windows on Arm: Qualcomm Snapdragon X series processor", U.premiere),
  r("premiere.win.ram.min", "premiere", "windows", "Memoria RAM", "minimum",
    { kind: "min_number", field: "ramGb", value: 8, unit: "GB", armValue: 16, note: "Para edición en HD. En Windows ARM el mínimo es 16 GB." }, "Memory 8 GB RAM; Windows on Arm: 16 GB", U.premiere),
  r("premiere.win.ram.rec", "premiere", "windows", "Memoria RAM", "recommended",
    { kind: "min_number", field: "ramGb", value: 16, unit: "GB", note: "16 GB para video HD; 32 GB o más para 4K." }, "16 GB RAM for HD media; 32 GB or more for 4K and higher", U.premiere),
  r("premiere.win.gpu.min", "premiere", "windows", "Tarjeta gráfica", "minimum", { kind: "gpu", minVramGb: 4, alsoNeeds: "en NVIDIA, generación Maxwell (2014) o más nueva" },
    "Windows with NVIDIA GPU: GPU must be of the Maxwell generation (2014) or newer and have at least 4GB of GPU memory; Windows with Intel or AMD GPU with at least 4GB of GPU memory", U.premiere),
  r("premiere.win.storage", "premiere", "windows", "Almacenamiento", "minimum",
    { kind: "min_number", field: "storageGb", value: 8, unit: "GB", note: "Es la capacidad total, no el espacio libre. No se instala en almacenamiento extraíble." }, "8 GB of available hard disk space, plus additional free space during installation", U.premiere),

  r("premiere.mac.os", "premiere", "macos", "Versión de macOS", "minimum", { kind: "mac_versions", min: 14 }, "Operating system macOS Sonoma (version 14); recommended: macOS Sonoma (version 14) and later", U.premiere),
  r("premiere.mac.cpu", "premiere", "macos", "Procesador", "minimum", {
    kind: "no_rule", why: "Pide Intel de 8.ª generación o más nueva con AVX2, o Apple silicon A18 o posterior. Hace falta el nombre exacto del chip y no queda claro cómo se comparan los chips M con 'A18 o posterior'.",
  }, "Intel 8th Generation or newer CPU with AVX2 support; Apple silicon A18 or later", U.premiere),
  r("premiere.mac.ram.min", "premiere", "macos", "Memoria RAM", "minimum",
    { kind: "min_number", field: "ramGb", value: 8, unit: "GB", note: "En Apple silicon, la memoria unificada también cubre la GPU." }, "Memory 8 GB RAM; GPU Apple silicon: 8GB of unified memory", U.premiere),
  r("premiere.mac.ram.rec", "premiere", "macos", "Memoria RAM", "recommended", { kind: "min_number", field: "ramGb", value: 16, unit: "GB", whenArch: "arm", note: "Recomendado en Apple silicon." },
    "Apple silicon: 16 GB unified memory", U.premiere),
  r("premiere.mac.gpu", "premiere", "macos", "Tarjeta gráfica (Mac con Intel)", "minimum", {
    kind: "no_rule", why: "En Mac con Intel pide gráficos integrados o AMD dedicada con 4 GB; no hay forma de comparar un modelo de gráficos integrados con esa regla.",
  }, "Intel processors: Integrated graphics, or AMD discrete graphics with 4GB of GPU memory", U.premiere),
  r("premiere.mac.storage", "premiere", "macos", "Almacenamiento", "minimum",
    { kind: "min_number", field: "storageGb", value: 8, unit: "GB", note: "Es la capacidad total, no el espacio libre." }, "8 GB of available hard disk space, plus additional free space during installation", U.premiere),

  // ------------------------------------------------------------------ Visual Studio 2022 (Windows only loaded)
  r("vs2022.win.os", "vs2022", "windows", "Sistema operativo", "minimum", {
    kind: "os_map", map: {
      win11_home: { state: "meets", quote: "Windows 11 supported OS versions: Home, Pro, Pro Education, Pro for Workstations, Enterprise, and Education" },
      win11_pro: { state: "meets", quote: "Windows 11 supported OS versions: Home, Pro, Pro Education, Pro for Workstations, Enterprise, and Education" },
      win10: { state: "cannot_decide", reason: "not_listed", note: "Windows 10 no aparece en la lista de sistemas compatibles de esa página (sí dice que Windows 10 en ARM64 no es compatible).", quote: "Visual Studio 2022 is supported on the following 64-bit operating systems: Windows 11...; Windows Server 2025/2022/2019/2016" },
    },
  }, "Visual Studio 2022 is supported on the following 64-bit operating systems: Windows 11 ...", U.vs),
  r("vs2022.win.arch", "vs2022", "windows", "Procesador (tipo)", "minimum", {
    kind: "arch_map", map: {
      x86_64: { state: "meets" },
      arm: { state: "meets", note: "ARM64 es compatible, con limitaciones.", caveat: "En ARM64 no se admiten estos componentes: desarrollo de Python, ciencia de datos y análisis, desarrollo móvil con C++, entre otros.", quote: "The following workloads and components are not supported by Visual Studio running on ARM64 operating systems: ... Data science and analytical applications. Python development." },
    },
  }, "ARM64 or x64 processor; Quad-core or better recommended. ARM 32 processors are not supported.", U.vs),
  r("vs2022.win.ram.min", "vs2022", "windows", "Memoria RAM", "minimum", { kind: "min_number", field: "ramGb", value: 4, unit: "GB" }, "Minimum of 4 GB of RAM.", U.vs),
  r("vs2022.win.ram.rec", "vs2022", "windows", "Memoria RAM", "recommended", { kind: "min_number", field: "ramGb", value: 16, unit: "GB" },
    "we recommend 16 GB RAM for typical professional solutions", U.vs),
  r("vs2022.win.storage.min", "vs2022", "windows", "Almacenamiento", "minimum",
    { kind: "min_number", field: "storageGb", value: 0.85, unit: "GB", note: "Es la capacidad total, no el espacio libre.", quoteHas: "850 MB" }, "Hard disk space: Minimum of 850 MB up to 210 GB of available space, depending on features installed", U.vs),
  r("vs2022.win.storage.rec", "vs2022", "windows", "Almacenamiento (instalación típica)", "recommended",
    { kind: "min_number", field: "storageGb", value: 20, unit: "GB", note: "Una instalación típica pide de 20 a 50 GB libres. Es la capacidad total, no el espacio libre.", quoteHas: "20-50 GB" }, "typical installations require 20-50 GB of free space", U.vs),
];

/** What the catalog does NOT check for each software and platform (shown before any result). */
export const NOT_CHECKED: Record<SoftwareId, Partial<Record<Platform, string[]>>> = {
  autocad: { windows: ["Resolución de pantalla (1920 x 1080)", "Versión de .NET"], macos: ["Resolución de pantalla"] },
  matlab: { windows: ["Productos adicionales (cada toolbox tiene sus propios requisitos)", "Espacio libre en disco (usamos la capacidad total)"] },
  solidworks: { windows: ["Disco SSD (recomendado, sin cifra)", "Versión de Microsoft Office, si usas esas funciones"], macos: [] },
  premiere: { windows: ["Pantalla (1920 x 1080)", "Tarjeta de sonido", "Disco rápido para medios"], macos: ["Pantalla (1920 x 1080)", "Disco rápido para medios"] },
  vs2022: { windows: ["Resolución de pantalla (1366 x 768 mínimo)", ".NET Framework 4.8 (se instala solo)"] },
};

export const swName = (id: string) => SOFTWARE.find((s) => s.id === id)?.name ?? id;
