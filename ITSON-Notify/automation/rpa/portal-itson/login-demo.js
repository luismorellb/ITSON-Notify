const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });
const { chromium } = require("playwright");

const LOGIN_URL = "https://ivirtual.itson.edu.mx/login/index.php";
const SESSION_DIR = path.join(__dirname, "..", "..", ".auth");
const SESSION_FILE = path.join(SESSION_DIR, "itson-state.json");

const SEL_SESION_OK = ".usermenu, #user-menu-toggle";
const SEL_ERROR = "#loginerrormessage, .loginerrors, .alert-danger";
const SEL_CAMBIO_PASS = 'input[name="newpassword1"]';

async function testLoginITSON() {
  if (!process.env.Id_User || !process.env.P_User) {
    console.error("Faltan Id_User o P_User en automation/.env");
    process.exit(1);
  }

  const browser = await chromium.launch({
    headless: process.env.HEADLESS !== "false", //En local false para ver navegador
    slowMo: 50,
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log("Abriendo iVirtual...");
    await page.goto(LOGIN_URL, { waitUntil: "networkidle" });

    console.log("Ingresando credenciales...");
    await page.fill("#username", process.env.Id_User);
    await page.fill("#password", process.env.P_User);
    await page.click('#login [type="submit"]');
    await page
      .locator(`${SEL_SESION_OK}, ${SEL_ERROR}, ${SEL_CAMBIO_PASS}`)
      .first()
      .waitFor({ timeout: 15000 })
      .catch(() => {});

    const url = page.url();
    const titulo = await page.title();
    await page.screenshot({ path: path.join(__dirname, "demo-login.png") });

    if (
      url.includes("change_password") ||
      (await page.locator(SEL_CAMBIO_PASS).count()) > 0
    ) {
      console.log(
        "El portal pide CAMBIO DE CONTRASEÑA. Se detiene el RPA; hay que actualizarla manualmente.",
      );
      process.exitCode = 2;
    } else if ((await page.locator(SEL_ERROR).count()) > 0) {
      console.log(
        "Login fallido: credenciales incorrectas. Favor de verificarlas.",
      );
      process.exitCode = 1;
    } else if (
      (await page.locator(SEL_SESION_OK).count()) > 0 &&
      !url.includes("/login/")
    ) {
      console.log(`¡Login exitoso! Título: ${titulo}`);
      console.log("URL:", url);
      fs.mkdirSync(SESSION_DIR, { recursive: true });
      await context.storageState({ path: SESSION_FILE });

      console.log("Su sesión ha sido guardada");
    } else {
      console.log(
        "Resultado no determinado: puede que se este ocupando una verificacion extra.",
      );
      console.log("URL actual:", url);
      process.exitCode = 1;
    }
  } catch (error) {
    console.error("Error durante la ejecución del RPA:", error);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

testLoginITSON();
