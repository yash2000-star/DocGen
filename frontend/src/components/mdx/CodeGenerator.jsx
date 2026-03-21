import React from "react";
import { CodeGroup } from "./CodeGroup";
import CodeBlock from "./CodeBlock";

export function CodeGenerator({ method = "GET", endpoint = "/", body = null }) {
  // In a real SaaS, this baseUrl would come from the user's mint.json config!
  const baseUrl = "https://api.yourdomain.com"; 
  const fullUrl = `${baseUrl}${endpoint}`;
  
  const methodUpper = method.toUpperCase();
  // Only POST, PUT, and PATCH requests should have a body
  const hasBody = body && ["POST", "PUT", "PATCH"].includes(methodUpper);
  const bodyString = hasBody ? JSON.stringify(body, null, 2) : "";

  // 1. Generate cURL Command
  let curlCode = `curl -X ${methodUpper} "${fullUrl}" \\\n  -H "Content-Type: application/json"`;
  if (hasBody) {
    curlCode += ` \\\n  -d '${bodyString}'`;
  }

  // 2. Generate JavaScript (Fetch) Code
  let jsCode = `fetch("${fullUrl}", {\n  method: "${methodUpper}",\n  headers: {\n    "Content-Type": "application/json"\n  }`;
  if (hasBody) {
    // Indent the JSON body properly for JS
    const indentedBody = bodyString.split('\n').join('\n  ');
    jsCode += `,\n  body: JSON.stringify(${indentedBody})\n`;
  } else {
    jsCode += `\n`;
  }
  jsCode += `})\n.then(response => response.json())\n.then(data => console.log(data));`;

  // 3. Generate Python (Requests) Code
  let pyCode = `import requests\n\nurl = "${fullUrl}"\nheaders = {"Content-Type": "application/json"}\n`;
  if (hasBody) {
    pyCode += `\npayload = ${bodyString}\n\nresponse = requests.${method.toLowerCase()}(url, headers=headers, json=payload)`;
  } else {
    pyCode += `\nresponse = requests.${method.toLowerCase()}(url, headers=headers)`;
  }
  pyCode += `\n\nprint(response.json())`;

  return (
    <div className="code-generator-wrapper" style={{ margin: "32px 0" }}>
      <div style={{ 
        fontSize: "12px", 
        fontWeight: "700", 
        color: "#64748b", 
        textTransform: "uppercase", 
        marginBottom: "12px", 
        letterSpacing: "0.5px",
      }}>
        Auto-Generated Examples
      </div>
      
      {/* We reuse your excellent CodeGroup and CodeBlock components here! */}
      <CodeGroup>
        <CodeBlock title="cURL" language="bash">
          {curlCode}
        </CodeBlock>
        
        <CodeBlock title="JavaScript" language="javascript">
          {jsCode}
        </CodeBlock>
        
        <CodeBlock title="Python" language="python">
          {pyCode}
        </CodeBlock>
      </CodeGroup>
    </div>
  );
}