const https = require("https");
const data = JSON.stringify({
  model: "deepseek-chat",
  messages: [{role:"user",content:"Analyze this trading arena: 21 agents started with 0.5 SOL each, now total is 0.15 SOL. 98% loss. Give strategic advice in 50 words."}],
  max_tokens: 150
});
const opts = {
  hostname: "api.deepseek.com",
  path: "/v1/chat/completions",
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer sk-013ebe9ef80e49bfbc1f02e8247875ca"
  }
};
const req = https.request(opts, res => {
  let body = "";
  res.on("data", d => body += d);
  res.on("end", () => {
    console.log("Response:", body);
    try {
      const parsed = JSON.parse(body);
      console.log("Content:", parsed.choices?.[0]?.message?.content);
    } catch(e) {
      console.log("Parse error:", e.message);
    }
  });
});
req.on("error", e => console.log("Error:", e.message));
req.write(data);
req.end();
