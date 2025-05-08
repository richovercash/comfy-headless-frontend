// src/components/CorsConfigGuide.jsx
import React from 'react';

const CorsConfigGuide = () => {
  return (
    <div className="cors-config-guide">
      <h2>ComfyUI CORS Configuration Guide</h2>
      
      <p>
        If you're experiencing CORS issues connecting your frontend to ComfyUI,
        you'll need to configure ComfyUI to accept cross-origin requests from your frontend.
      </p>
      
      <h3>Method 1: Using ComfyUI's Extra Options</h3>
      
      <div className="code-example">
        <pre>
          {`python main.py --listen 0.0.0.0 --port 8188 --enable-cors-header="*"`}
        </pre>
      </div>
      
      <p>
        This allows requests from any origin. For production, you should restrict this to your specific frontend domain:
      </p>
      
      <div className="code-example">
        <pre>
          {`python main.py --listen 0.0.0.0 --port 8188 --enable-cors-header="https://your-frontend-domain.com"`}
        </pre>
      </div>
      
      <h3>Method 2: Using a CORS Proxy</h3>
      
      <p>
        If you can't modify ComfyUI's configuration, you can set up a CORS proxy server:
      </p>
      
      <ol>
        <li>
          <p>Install cors-anywhere:</p>
          <pre>npm install -g cors-anywhere</pre>
        </li>
        <li>
          <p>Run the proxy server:</p>
          <pre>cors-anywhere</pre>
        </li>
        <li>
          <p>Update your frontend to use the proxy URL:</p>
          <pre>const COMFYUI_API_URL = 'http://localhost:8080/http://localhost:8188';</pre>
        </li>
      </ol>
      
      <h3>Method 3: Using Environment Variables</h3>
      
      <p>
        Add these to your .env file:
      </p>
      
      <div className="code-example">
        <pre>
          {`REACT_APP_COMFYUI_API_URL=http://localhost:8188/
REACT_APP_COMFYUI_WS_URL=ws://localhost:8188/ws`}
        </pre>
      </div>
      
      <p>
        Then configure your development server to proxy requests:
      </p>
      
      <div className="code-example">
        <pre>
          {`// In package.json
"proxy": "http://localhost:8188"`}
        </pre>
      </div>
      
      <p>
        Or in your webpack.config.js:
      </p>
      
      <div className="code-example">
        <pre>
          {`devServer: {
  proxy: {
    '/api': {
      target: 'http://localhost:8188',
      pathRewrite: { '^/api': '' },
      changeOrigin: true,
    },
    '/ws': {
      target: 'ws://localhost:8188',
      ws: true,
    },
  },
}`}
        </pre>
      </div>
    </div>
  );
};
console.log("ComfyUI API URL:", process.env.REACT_APP_COMFYUI_API_URL);
console.log("ComfyUI WS URL:", process.env.REACT_APP_COMFYUI_WS_URL);
export default CorsConfigGuide;