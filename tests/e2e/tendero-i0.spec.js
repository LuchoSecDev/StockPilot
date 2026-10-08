const { test, expect } = require('@playwright/test');

test.describe('I0: Restricciones de Tendero en Inventario', () => {
  test('El Tendero escanea un código y solo ve "Sumar stock", no ve "Reporte" ni "Activar Oferta"', async ({ page }) => {
    // 1. Ir a Login
    await page.goto('/login');
    
    // 2. Llenar Credenciales del Tendero (creado en el seed)
    await page.fill('#identificador', 'tendero');
    await page.fill('#password', 'tendero123');
    
    // 3. Ingresar
    await page.click('button[type="submit"]');
    
    try {
      await expect(page.getByText('Cerrar otra sesión e ingresar aquí')).toBeVisible({ timeout: 2000 });
      await page.getByText('Cerrar otra sesión e ingresar aquí').click();
    } catch (e) {}
    
    // Verificar que entra
    await expect(page).toHaveURL(/.*dashboard/);
    
    // 4. Navegar a Productos (Catálogo)
    await page.click('nav >> text=Catálogo');
    await expect(page).toHaveURL(/.*productos/);
    
    // Esperar a que la tabla cargue los productos reales (no los skeletons de carga)
    await expect(page.locator('table tbody tr:not(.animate-pulse)').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Arroz Diana 1Kg')).toBeVisible({ timeout: 10000 });

    // 5. Simular escaneo de código de barras (producto existente)
    // El hook requiere que el foco NO esté en un input para que capture globalmente
    await page.keyboard.press('Escape'); // Quitar foco de posibles inputs
    
    // Enviar el código rápido para pasar el threshold de 150ms
    await page.keyboard.type('GR001', { delay: 10 });
    await page.keyboard.press('Enter');
    
    // 6. Debe abrirse el modal y mostrar "Sumar stock"
    const modal = page.locator('div[role="dialog"]');
    await expect(modal).toBeVisible();
    
    // Verificar que diga "Sumar stock"
    await expect(modal).toContainText(/Sumar stock/i);
    
    // Verificar que NO vea "Reporte" ni "Activar Oferta" (botones del administrador)
    await expect(modal.getByText(/Reporte|Generar Reporte/i)).not.toBeVisible();
    await expect(modal.getByText(/Activar Oferta/i)).not.toBeVisible();
  });
});
