const { test, expect } = require('@playwright/test');

// Credenciales de un Administrador SIN 2FA activo. Por defecto las de la semilla de desarrollo; se pueden
// cambiar para correr contra otro entorno: E2E_ADMIN_USER=... E2E_ADMIN_PASS=... npx playwright test
const USUARIO = process.env.E2E_ADMIN_USER || 'admin';
const CLAVE = process.env.E2E_ADMIN_PASS || 'admin123';

async function iniciarSesion(page) {
  await page.goto('/login');
  await page.fill('#identificador', USUARIO);
  await page.fill('#password', CLAVE);
  await page.click('button[type="submit"]');

  const cerrarOtraSesion = page.getByText('Cerrar otra sesión e ingresar aquí');
  if (await cerrarOtraSesion.isVisible({ timeout: 2000 }).catch(() => false)) {
    await cerrarOtraSesion.click();
  }
  await expect(page).toHaveURL(/.*dashboard/);
}

// Durante el piloto la política de 2FA del servidor está APAGADA (REQUIRE_ADMIN_2FA sin definir): el 2FA se
// recomienda, no se exige. Estas pruebas fijan eso desde la pantalla. El caso con la política encendida
// (403 DOS_FACTORES_REQUERIDO → se abre el aviso) lo cubren las pruebas de integración de la API.
test.describe.serial('Aviso de 2FA para el Administrador (política apagada)', () => {

  test('informa que la función existe, sin bloquear nada ni abrir ventanas por sí solo', async ({ page }) => {
    await iniciarSesion(page);

    // 1. No hay ventana emergente al entrar; sí un aviso discreto en el encabezado
    const modal2FA = page.locator('form').filter({ hasText: /Protege tu cuenta|Activa la verificación en dos pasos/i });
    await expect(modal2FA).toBeHidden();
    const aviso = page.getByRole('button', { name: /verificación en 2 pasos/i }).first();
    await expect(aviso).toBeVisible();

    // 2. Puede trabajar con normalidad: "Registrar Producto" abre el formulario (no lo frena el navegador)
    await page.click('nav >> text=Catálogo');
    await expect(page).toHaveURL(/.*productos/);
    await page.getByRole('button', { name: /Registrar Producto/i }).click();
    await expect(page.getByPlaceholder('Ej: Arroz roa 500g')).toBeVisible();
    await page.getByRole('button', { name: '×' }).click();
    await expect(page.getByPlaceholder('Ej: Arroz roa 500g')).toBeHidden();

    // 3. El aviso abre la activación (voluntaria) y se puede posponer
    await aviso.click();
    await expect(modal2FA).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Protege tu cuenta' })).toBeVisible();
    await page.getByText('Configurar más tarde').click();
    await expect(modal2FA).toBeHidden();
  });

  test('al volver a iniciar sesión sigue sin abrir ventanas, y el aviso sigue ahí', async ({ page }) => {
    await iniciarSesion(page);
    await page.click('button:has-text("Cerrar Sesión")');
    await expect(page).toHaveURL(/.*login/);

    await iniciarSesion(page);

    await expect(page.locator('form').filter({ hasText: /Protege tu cuenta/i })).toBeHidden();
    await expect(page.getByRole('button', { name: /verificación en 2 pasos/i }).first()).toBeVisible();
  });

});
