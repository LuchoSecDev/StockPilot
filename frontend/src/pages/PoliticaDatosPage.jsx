import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

const Seccion = ({ titulo, children }) => (
  <div className="space-y-2">
    <h2 className="titular text-lg text-tinta">{titulo}</h2>
    <div className="text-sm text-slate-600 leading-relaxed space-y-2">{children}</div>
  </div>
);

const PoliticaDatosPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-papel flex justify-center p-6">
      <div className="w-full max-w-3xl my-10">
        <div className="bg-white p-8 md:p-12 rounded-2xl shadow-lg border border-slate-200 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-azul"></div>

          <button
            onClick={() => navigate(-1)}
            className="text-slate-500 hover:text-azul transition-colors flex items-center gap-2 text-xs font-bold mb-8 mt-2"
          >
            <ArrowLeft size={16} /> Volver
          </button>

          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-azul text-white rounded-xl flex items-center justify-center shrink-0">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h1 className="titular text-2xl text-tinta">Política de Tratamiento de Datos</h1>
              <p className="text-xs text-slate-500 font-bold">Conforme a la Ley 1581 de 2012 (Habeas Data) — Colombia</p>
            </div>
          </div>

          <div className="space-y-6">
            <Seccion titulo="1. Responsable del tratamiento">
              <p>
                StockPilot es la plataforma responsable del tratamiento de los datos personales y de negocio que usted
                registra al crear una cuenta y usar la aplicación. Este documento explica qué información se recopila,
                para qué se usa y qué derechos tiene sobre ella.
              </p>
            </Seccion>

            <Seccion titulo="2. Qué datos se recopilan">
              <p>
                Datos de la persona que se registra: nombre, correo electrónico, celular, usuario y contraseña
                (almacenada cifrada, nunca en texto plano). Datos del negocio: nombre y dirección de la tienda,
                catálogo de productos, ventas, movimientos de inventario, proveedores y órdenes de compra que usted
                y su equipo registren durante el uso normal de la aplicación.
              </p>
            </Seccion>

            <Seccion titulo="3. Para qué se usan">
              <p>
                Exclusivamente para prestar el servicio: calcular alertas de stock y vencimiento, generar
                recomendaciones de compra (incluyendo las que produce el módulo de inteligencia artificial),
                elaborar reportes y mantener su sesión segura. Los datos de negocio no se comparten con otros
                usuarios ni se venden a terceros. Para las funciones de inteligencia artificial, un resumen
                numérico de su inventario (sin datos personales) se envía a la API de OpenAI para generar la
                recomendación; StockPilot no envía nombres, correos ni contraseñas a ese servicio.
              </p>
              <p>
                Para operar y mejorar el servicio, el equipo de StockPilot consulta métricas agregadas de uso de cada
                tienda (fecha de registro, número de productos cargados, número de días con ventas y fecha del último
                acceso). Estas métricas no incluyen los montos de las ventas, los productos vendidos ni los datos de
                los clientes de la tienda. Cada consulta del equipo queda registrada.
              </p>
            </Seccion>

            <Seccion titulo="4. Sus derechos">
              <p>
                Como titular de los datos, usted tiene derecho a conocer, actualizar, rectificar y solicitar la
                supresión de su información en cualquier momento, así como a revocar la autorización para su
                tratamiento. Puede ejercer estos derechos escribiendo a través del soporte de la plataforma o
                directamente a los correos de contacto del equipo. Al eliminar su cuenta, los datos de negocio
                asociados se eliminan de forma permanente salvo obligación legal de conservarlos.
              </p>
            </Seccion>

            <Seccion titulo="5. Vigencia">
              <p>
                Los datos se conservan mientras la cuenta permanezca activa. Si usted solicita la eliminación de su
                cuenta, sus datos se eliminan de la base de datos de producción; los respaldos de seguridad
                (retenidos por un plazo corto para recuperación ante fallos) se purgan en el ciclo normal de rotación.
              </p>
            </Seccion>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PoliticaDatosPage;
