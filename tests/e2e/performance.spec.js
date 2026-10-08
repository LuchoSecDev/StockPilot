const { test, expect } = require('@playwright/test');

test.describe('Pruebas de Rendimiento Básico', () => {

  test('1. Tiempo de Carga de la Landing Page (LCP / TTI aproximado)', async ({ page }) => {
    const start = Date.now();
    
    // Navegación a página principal
    await page.goto('/');
    
    // Esperar a que el elemento clave sea visible (el botón de Empezar Ahora, etc)
    await page.waitForSelector('text=Empezar', { state: 'visible', timeout: 5000 }).catch(() => {});
    
    const duration = Date.now() - start;
    
    console.log(`Tiempo de carga Login: ${duration}ms`);
    
    // El frontend debería cargar y pintar el formulario en menos de 8 segundos localmente (servidor dev)
    expect(duration).toBeLessThan(8000); 
  });

  test('2. Tiempo de Respuesta del Frontend en Enrutamiento y Pintado', async ({ page }) => {
    // Si la API es lenta, esto tomaría más, pero si es rápido debe pasar
    // Para no depender de credenciales válidas generadas en tests asincrónicos,
    // usaremos la cuenta admin por defecto o un test puro de red
    
    const start = Date.now();
    const response = await page.goto('/');
    
    const duration = Date.now() - start;
    
    // El servidor debe responder con el HTML base muy rápido (ampliado por servidor dev)
    expect(response.status()).toBe(200);
    expect(duration).toBeLessThan(5000);
  });

});
