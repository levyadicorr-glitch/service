import { toWhatsAppChatId, getQuoteNotificationPhones } from '../src/lib/greenApi';

console.log('=============== [RUNNING SMOKETEST] ===============');

// Test 1: Phone normalization
console.log('\n--- TEST 1: Phone Normalization ---');
const phonesToTest = [
  '0501234567',
  '050-123-4567',
  '972501234567',
  '+972-50-123-4567',
  '0529998877',
];

for (const p of phonesToTest) {
  const result = toWhatsAppChatId(p);
  console.log(`Phone: "${p}" => ChatID: "${result}"`);
  if (!result || !result.endsWith('@c.us')) {
    console.error(`❌ FAILURE in phone normalization for: ${p}`);
    process.exit(1);
  }
}
console.log('✅ TEST 1 PASSED!');

// Test 2: Admin Quote Notification Phone Resolution
console.log('\n--- TEST 2: Admin Quote Notification Phone Resolution ---');
const mockTenant1 = {
  quoteNotificationPhones: '0501111111, 0522222222',
  adminWhatsappPhone: '0533333333',
};
const res1 = getQuoteNotificationPhones(mockTenant1);
console.log('Tenant with explicit quoteNotificationPhones:', res1);
if (res1.length !== 2 || res1[0] !== '0501111111' || res1[1] !== '0522222222') {
  console.error('❌ FAILURE in quote notification phone resolution (explicit)');
  process.exit(1);
}

const mockTenant2 = {
  quoteNotificationPhones: '',
  adminWhatsappPhone: '0533333333',
  adminWhatsappPhone2: '0544444444',
};
const res2 = getQuoteNotificationPhones(mockTenant2);
console.log('Tenant with fallback adminWhatsappPhone:', res2);
if (res2.length !== 2 || res2[0] !== '0533333333' || res2[1] !== '0544444444') {
  console.error('❌ FAILURE in quote notification phone resolution (fallback)');
  process.exit(1);
}
console.log('✅ TEST 2 PASSED!');

// Test 3: Approval Keyword Matching Regex
console.log('\n--- TEST 3: Approval Keyword Matching Regex ---');
const approvalRegex = /מאשר|מאשרת|כן|סגור|תזמין|תשלח|אישור|אשר|אשמח|yes|ok/i;
const validKeywords = ['מאשר', 'מאשרת', 'כן, תזמין לי', 'סגור אחי', 'תשלח בהקדם', 'אשמח לקבל', 'YES', 'OK'];
const invalidKeywords = ['כמה זה עולה?', 'לא רוצה', 'תבטל', 'איפה אתם נממצאים?'];

for (const word of validKeywords) {
  const match = approvalRegex.test(word);
  console.log(`Word: "${word}" => Match: ${match}`);
  if (!match) {
    console.error(`❌ FAILURE: Expected match for valid approval word: ${word}`);
    process.exit(1);
  }
}

for (const word of invalidKeywords) {
  const match = approvalRegex.test(word);
  console.log(`Word: "${word}" => Match: ${match}`);
  if (match) {
    console.error(`❌ FAILURE: Expected NO match for invalid word: ${word}`);
    process.exit(1);
  }
}
console.log('✅ TEST 3 PASSED!');

console.log('\n===================================================');
console.log('🎉 ALL SMOKETEST CHECKS PASSED SUCCESSFULLY!');
console.log('===================================================');
