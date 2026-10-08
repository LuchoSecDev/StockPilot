const { test, expect } = require('@playwright/test');

test.describe('Auditoría Integral StockPilot', () => {
  
  test('Flujo Completo: Login -> Dashboard -> Inventario', async ({ page }) => {
    // 1. Ir a Login
    await page.goto('/login');
    
    // 2. Llenar Credenciales Reales (basadas en seed data)
    await page.fill('#identificador', 'admin');
    await page.fill('#password', 'admin123');
    
    // 4. Ingresar
    await page.click('button:has-text("Ingresar a mi Negocio")');
    
    try {
      await expect(page.getByText('Cerrar otra sesión e ingresar aquí')).toBeVisible({ timeout: 2000 });
      await page.getByText('Cerrar otra sesión e ingresar aquí').click();
    } catch (e) {}

    // Si aparece el modal de 2FA obligatorio para el admin, descartarlo para continuar la auditoría
    try {
      const skip2FA = page.getByText('Configurar más tarde');
      await expect(skip2FA).toBeVisible({ timeout: 2000 });
      await skip2FA.click();
    } catch (e) {}

    // 5. Verificar que llegamos al Dashboard (buscando un título único del dashboard)
    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page.locator('h1').filter({ hasText: /Vista General/i })).toBeVisible();
    
    // Esperar a que carguen las estadísticas (buscamos un símbolo de moneda o un valor)
    const statsCard = page.locator('text=Valor Inventario').or(page.locator('text=Ventas de Hoy')).first();
    await expect(statsCard).toBeVisible();

    // 6. Navegar a Productos usando el Sidebar
    // Buscamos el enlace que dice "Catálogo" (según tu Sidebar.jsx)
    await page.click('nav >> text=Catálogo');
    
    // 7. Verificar Inventario
    await expect(page).toHaveURL(/.*productos/);
    await expect(page.getByRole('heading', { level: 2, name: /Inventario|Tus Productos/i })).toBeVisible();
    
    // Verificar que la tabla de productos tenga contenido
    const tablaProductos = page.locator('table');
    await expect(tablaProductos).toBeVisible();
    
    // Verificar que haya al menos una fila de datos (excluyendo el encabezado)
    const filasProductos = page.locator('tbody tr');
    const conteo = await filasProductos.count();
    console.log(`Auditoría: Se encontraron ${conteo} productos en bodega.`);
    expect(conteo).toBeGreaterThan(0);
    
    // 8. Cerrar Sesión (Finalizar Ciclo)
    await page.click('button:has-text("Cerrar Sesión")');
    await expect(page).toHaveURL(/.*login/);
  });
});
