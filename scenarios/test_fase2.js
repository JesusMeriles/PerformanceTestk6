import { config } from '../lib/config.js';
import { generateAssessmentPayload, realisticSleep } from '../lib/helpers.js';
import { SharedArray } from 'k6/data';

const evaluacionBase = JSON.parse(open('../data/evaluacion.json'));
const users = new SharedArray('users', function () {
  return JSON.parse(open('../data/users.json'));
});

export const options = {
  vus: 1,
  iterations: 1,
};

export default function () {
  console.log(`Config Base BFF: ${config.baseUrlBff}`);
  console.log(`Loaded ${users.length} users successfully.`);
  
  // Test payload generation for creation (id = 0)
  const payloadCreate = generateAssessmentPayload(evaluacionBase, { isUpdate: false });
  if (payloadCreate.id !== 0) throw new Error('Create ID should be 0');
  console.log(`Payload create test: id=${payloadCreate.id}, customer=${payloadCreate.assessmentCustomerId}`);

  // Test payload generation for update (id > 0)
  const payloadUpdate = generateAssessmentPayload(evaluacionBase, { isUpdate: true, assessmentId: 5555 });
  if (payloadUpdate.id !== 5555) throw new Error('Update ID should be 5555');
  console.log(`Payload update test: id=${payloadUpdate.id}, customer=${payloadUpdate.assessmentCustomerId}`);

  console.log('Fase 2 syntax & unit validation OK!');
}

