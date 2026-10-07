const { test, expect } = require('@playwright/test');

test.describe.serial('Seguridad 2FA para Administrador en Acciones CRUD', () => {

  test('Flujo Completo: Login -> Descartar 2FA -> Bloqueo CRUD y Re-apertura -> Logout y Recordatorio al reingresar', async ({ page }) => {
    // 1. Iniciar sesión como Administrador
    await page.goto('/login');
    await page.fill('#identificador', 'admin');
    await page.fill('#password', 'admin123');
    await page.click('button[type="submit"]');

    try {
      const cerrarSesion = page.getByText('Cerrar otra sesión e ingresar aquí');
      if (await cerrarSesion.isVisible({ timeout: 2000 }).catch(() => false)) {
        await cerrarSesion.click();
      }
    } catch (e) {}

    await expect(page).toHaveURL(/.*dashboard/);

    // 2. Verificar que aparece el modal de 2FA obligatorio
    const modal2FA = page.locator('form').filter({ hasText: /Configurar Seguridad/i });
    await expect(modal2FA).toBeVisible();

    // 3. Posponer configuración con "Configurar más tarde"
    const btnMasTarde = page.getByText('Configurar más tarde');
    await expect(btnMasTarde).toBeVisible();
    await btnMasTarde.click();

    // 4. Verificar que el modal se cierra y el usuario puede navegar
    await expect(modal2FA).toBeHidden();

    // 5. Navegar a Catálogo (Productos)
    await page.click('nav >> text=Catálogo');
    await expect(page).toHaveURL(/.*productos/);
    await expect(page.locator('table tbody tr:not(.animate-pulse)').first()).toBeVisible({ timeout: 10000 });

    // 6. Verificar que aparece la píldora informativa en el layout avisando que 2FA está pendiente
    await expect(page.getByText(/2FA Pendiente/i).first()).toBeVisible();

    // 7. Intentar acción CRUD: "Registrar Producto"
    const btnRegistrar = page.getByRole('button', { name: /Registrar Producto/i });
    await expect(btnRegistrar).toBeVisible();
    await btnRegistrar.click();

    // 8. VERIFICACIÓN CRÍTICA:
    // El modal de crear producto NO debe abrirse
    const modalCrearProducto = page.locator('form').filter({ hasText: /Nuevo Producto/i });
    await expect(modalCrearProducto).toBeHidden();

    // En su lugar, el modal de 2FA DEBE reabrirse automáticamente exigiendo la configuración
    await expect(modal2FA).toBeVisible();
    await expect(page.getByText(/Debes configurar la autenticación 2FA antes de registrar nuevos productos/i).first()).toBeVisible();

    // 9. Posponerlo nuevamente
    await page.getByText('Configurar más tarde').click();
    await expect(modal2FA).toBeHidden();

    // 10. Intentar otra acción CRUD: "Importar" productos
    const btnImportar = page.getByRole('button', { name: /Importar/i });
    await expect(btnImportar).toBeVisible();
    await btnImportar.click();

    // Debe volver a bloquear y reabrir el modal de 2FA
    await expect(modal2FA).toBeVisible();
    await expect(page.getByText(/Debes configurar la autenticación 2FA antes de importar productos/i).first()).toBeVisible();

    // Posponerlo para cerrar sesión
    await page.getByText('Configurar más tarde').click();
    await expect(modal2FA).toBeHidden();

    // 11. Cerrar Sesión
    await page.click('button:has-text("Cerrar Sesión")');
    await expect(page).toHaveURL(/.*login/);

    // 12. Volver a iniciar sesión: Debe recordar la configuración y mostrar el modal de nuevo
    await page.fill('#identificador', 'admin');
    await page.fill('#password', 'admin123');
    await page.click('button[type="submit"]');

    try {
      const cerrarSesion = page.getByText('Cerrar otra sesión e ingresar aquí');
      if (await cerrarSesion.isVisible({ timeout: 2000 }).catch(() => false)) {
        await cerrarSesion.click();
      }
    } catch (e) {}

    await expect(page).toHaveURL(/.*dashboard/);

    // VERIFICACIÓN CRÍTICA: El modal de 2FA reaparece automáticamente tras el login
    await expect(modal2FA).toBeVisible({ timeout: 5000 });
  });

});
