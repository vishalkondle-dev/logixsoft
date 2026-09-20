async function testLiveWs() {
  const outletId = 'outlet_EL3OT7iEQJCUwsi7mszOm2be';
  const wsUrl = `wss://dine-api.logixsoft.in/api/live/outlets/${outletId}`;
  console.log('Testing WebSocket connection to:', wsUrl);

  const ws = new WebSocket(wsUrl);

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('WebSocket connection timeout after 10s'));
    }, 10000);

    ws.onopen = () => {
      console.log('✅ WebSocket successfully opened and connected to OutletRoomDO!');
      ws.send(JSON.stringify({ type: 'ping' }));
    };

    ws.onmessage = (event) => {
      console.log('📥 Received message from Durable Object:', event.data);
      clearTimeout(timeout);
      ws.close();
      resolve();
    };

    ws.onerror = (err) => {
      clearTimeout(timeout);
      reject(err);
    };
  });

  console.log('✅ Durable Object WebSocket test passed with flying colors!');
}

testLiveWs().catch((err) => {
  console.error('❌ WS test failed:', err);
  process.exit(1);
});
