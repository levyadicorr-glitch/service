async function run() {
  const res = await fetch('http://localhost:3001/api/supadmin/tenants', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer 12341234'
    },
    body: JSON.stringify({
      tenantId: 'gowheels',
      businessName: 'Gowheels',
      adminPassword: '123'
    })
  });
  const data = await res.json();
  console.log(res.status, data);
}
run();
