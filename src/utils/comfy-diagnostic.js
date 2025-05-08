// ComfyUI Connection Diagnostics Utility
const diagnoseCowfyUIConnection = async () => {
    const results = {
      endpoint: false,
      authentication: false,
      requestFormatting: false,
      responseHandling: false
    };
    
    console.log("Starting ComfyUI connection diagnostics...");
    
    // 1. Check endpoint connection
    try {
      const response = await fetch(`${process.env.REACT_APP_COMFYUI_API_URL}/system_stats`);
      if (response.ok) {
        results.endpoint = true;
        console.log("✅ Endpoint connection successful");
      } else {
        console.error(`❌ Endpoint connection failed with status: ${response.status}`);
      }
    } catch (error) {
      console.error("❌ Endpoint connection error:", error.message);
    }
    
    // 2. Test authentication if applicable
    // (ComfyUI may not require auth, but if you've set it up, test it here)
    
    // 3. Test request formatting with a simple prompt
    try {
      const testWorkflow = {
        // Simple test workflow JSON structure
        // This would be your actual ComfyUI workflow structure
        prompt: "Test vehicle",
        // Other required parameters
      };
      
      const response = await fetch(`${process.env.REACT_APP_COMFYUI_API_URL}/prompt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testWorkflow),
      });
      
      if (response.ok) {
        results.requestFormatting = true;
        console.log("✅ Request formatting test passed");
        
        // 4. Test response handling
        const data = await response.json();
        if (data && data.prompt_id) {
          results.responseHandling = true;
          console.log("✅ Response handling test passed");
        } else {
          console.error("❌ Response handling test failed - missing expected data");
        }
      } else {
        console.error(`❌ Request formatting test failed with status: ${response.status}`);
        const errorText = await response.text();
        console.error("Error details:", errorText);
      }
    } catch (error) {
      console.error("❌ Request/response test error:", error.message);
    }
    
    console.log("Diagnostics complete:", results);
    return results;
  };