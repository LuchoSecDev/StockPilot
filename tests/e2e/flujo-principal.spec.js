/* global document */
const { test, expect } = require('@playwright/test');

test.describe.serial('Flujo Principal (Happy Paths)', () => {
  let uniqueId = Date.now();
  
  test('1. Registro de Administrador y Creación de Tienda', async ({ page }) => {
    await page.goto('/register');
    
    await page.fill('#nombres', `Admin Prueba ${uniqueId}`);
    await page.fill('#correo', `admin_${uniqueId}@test.com`);
    await page.fill('#celular', '1234567890');
    await page.fill('#usuario', `admin_${uniqueId}`);
    await page.fill('#contrasena', 'password123');
    await page.fill('#confirmarContrasena', 'password123');
    await page.check('#acepta_politica');
    await page.fill('#store_name', `Tienda ${uniqueId}`);
    await page.fill('#store_address', 'Calle Falsa 123');
    
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 10000 });
    await page.getByText('Configurar más tarde').click({ timeout: 3000 }).catch(() => {});
  });

  test('2. Inicio de Sesión', async ({ page }) => {
    await page.goto('/login');
    
    await page.fill('#identificador', `admin_${uniqueId}`);
    await page.fill('#password', 'password123');
    await page.click('button[type="submit"]');
    
    await page.getByText('Cerrar otra sesión e ingresar aquí').click({ timeout: 2000 }).catch(() => {});

    // Debería redirigir a dashboard
    await expect(page).toHaveURL(/.*\/dashboard/);
    await page.getByText('Configurar más tarde').click({ timeout: 3000 }).catch(() => {});
  });

  test('3. Crear Colaborador y Validar Restricción Única', async ({ page }) => {
    // Primero hacemos login
    await page.goto('/login');
    await page.fill('#identificador', `admin_${uniqueId}`);
    await page.fill('#password', 'password123');
    await page.click('button[type="submit"]');
    
    try {
      const cerrarSesion = page.getByText('Cerrar otra sesión e ingresar aquí');
      if (await cerrarSesion.isVisible({ timeout: 2000 }).catch(() => false)) {
        await cerrarSesion.click();
      }
    } catch (e) {}

    await expect(page).toHaveURL(/.*\/dashboard/);

    try {
      const skip2FA = page.getByText('Configurar más tarde');
      if (await skip2FA.isVisible({ timeout: 2000 }).catch(() => false)) {
        await skip2FA.click();
      }
    } catch (e) {}
    
    // Navegar a Registro Tendero (Colaboradores)
    await page.goto('/registro-tendero');

    // Descartar modal 2FA si aparece
    await page.getByText('Configurar más tarde').click({ timeout: 3000 }).catch(() => {});
    await page.getByText('Configurar más tarde').waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
    
    // Rellenar form para un nuevo tendero
    const tenderoUsername = `colab_${uniqueId}`;
    const tenderoEmail = `colab_${uniqueId}@test.com`;

    await page.fill('input#nombres', 'Colaborador E2E');
    await page.fill('input#celular', '3000000000');
    
    // Selector custom para género
    await page.click('text=Selec...');
    await page.getByRole('option', { name: 'Femenino' }).click();
    
    await page.fill('input#correo', tenderoEmail);
    await page.fill('input#usuario', tenderoUsername);
    await page.fill('input#contrasena', 'tendero123');
    
    await page.click('button[type="submit"]');
    
    // 3.1. Validar que la creación fue exitosa
    const successToast = page.getByText(/Nuevo colaborador registrado con éxito/i).first();
    await expect(successToast).toBeVisible({ timeout: 5000 });
    
    // 3.2. Probar restricción única (crear el mismo)
    await page.fill('input#nombres', 'Colaborador E2E Repetido');
    await page.fill('input#celular', '3000000001');
    await page.click('text=Selec...');
    await page.getByRole('option', { name: 'Femenino' }).click();
    await page.fill('input#correo', tenderoEmail);
    await page.fill('input#usuario', tenderoUsername);
    await page.fill('input#contrasena', 'tendero123');
    await page.click('button[type="submit"]');
    
    // Verificar que aparece error de correo/usuario ya existe (toast)
    const errorToast = page.getByText(/El correo o usuario ya existe|ya existe/i).first();
    await expect(errorToast).toBeVisible();
  });

});
