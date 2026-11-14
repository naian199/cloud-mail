import test from 'node:test';
import assert from 'node:assert/strict';
import { registrationEmail, registrationPrefix, registrationNeedsChallenge } from '../../mail-vue/src/utils/registration.mjs';
import { registrationDomains } from '../src/lib/registration-domains.mjs';

test('excluding a domain from registration preserves the full mailbox configuration', () => {
 const domain = ['example.com', 'legacy.example.com', 'other.example.com'];
 assert.deepEqual(registrationDomains({ domain }), domain);
 assert.deepEqual(registrationDomains({ domain, registration_excluded_domains: ['legacy.example.com'] }), ['example.com', 'other.example.com']);
 assert.deepEqual(registrationDomains({ domain: JSON.stringify(domain), registration_excluded_domains: '["legacy.example.com"]' }), ['example.com', 'other.example.com']);
 assert.equal(domain.length, 3);
});
test('autofill and pasted full addresses do not receive a second domain suffix',()=>{
 assert.equal(registrationEmail('alice','@example.com'),'alice@example.com');
 assert.equal(registrationEmail(' alice@example.com ','@example.com'),'alice@example.com');
 assert.equal(registrationEmail(' alice@other.org ','@example.com'),'alice@other.org');
 assert.equal(registrationEmail('alice','@example.com',true),'alice');
 assert.equal(registrationEmail('   ','@example.com'),'');
 assert.equal(registrationPrefix(' alice@example.com '),'alice');
});
test('ordinary validation failures never trigger a bot challenge',()=>{
 for(const error of [undefined,{code:400,errorKey:'invalidInput'},{code:501,errorKey:'server_isRegAccount'},{code:400},{code:403,errorKey:'server_botVerifyFail'}])assert.equal(registrationNeedsChallenge(error),false);
 assert.equal(registrationNeedsChallenge({code:400,errorKey:'server_emptyBotToken'}),true);
 assert.equal(registrationNeedsChallenge({code:400,errorKey:'server_botVerifyFail'}),true);
});
