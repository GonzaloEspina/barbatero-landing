export default function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Test Original Logic</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; }
          .container { max-width: 600px; }
          input, button { padding: 10px; margin: 10px 0; }
          input { width: 300px; }
          button { background: #0070f3; color: white; border: none; cursor: pointer; }
          .result { margin-top: 20px; padding: 20px; background: #f5f5f5; white-space: pre-wrap; }
          .success { background: #d4edda; border: 1px solid #c3e6cb; }
          .error { background: #f8d7da; border: 1px solid #f5c6cb; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🔍 Test Original Logic</h1>
          <p>Probar con la lógica exacta de la versión que funcionaba:</p>
          
          <input type="text" id="contacto" placeholder="exe.damiano@gmail.com" value="exe.damiano@gmail.com">
          <br>
          <button onclick="testOriginal()">🎯 Buscar con Lógica Original</button>
          
          <div id="result" class="result" style="display: none;"></div>
        </div>
        
        <script>
          async function testOriginal() {
            const contacto = document.getElementById('contacto').value;
            const resultDiv = document.getElementById('result');
            
            if (!contacto) {
              alert('Ingresa un contacto');
              return;
            }
            
            resultDiv.style.display = 'block';
            resultDiv.className = 'result';
            resultDiv.textContent = 'Probando lógica original...';
            
            try {
              const response = await fetch('/api/turnos/find-client-original', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contacto })
              });
              
              const data = await response.json();
              
              if (data.found) {
                resultDiv.className = 'result success';
                resultDiv.textContent = '🎉 ¡CLIENTE ENCONTRADO CON LÓGICA ORIGINAL!\\n\\n' + JSON.stringify(data, null, 2);
              } else {
                resultDiv.className = 'result error';
                resultDiv.textContent = '❌ Cliente no encontrado:\\n\\n' + JSON.stringify(data, null, 2);
              }
            } catch (e) {
              resultDiv.className = 'result error';
              resultDiv.textContent = '💥 Error: ' + e.message;
            }
          }
        </script>
      </body>
      </html>
    `);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}