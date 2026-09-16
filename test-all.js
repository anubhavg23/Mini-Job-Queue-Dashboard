const API = 'http://localhost:3000';

async function testSuite() {
  console.log('=== RUNNING MINI JOB QUEUE DASHBOARD TEST SUITE ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, description, detail = '') {
    if (condition) {
      console.log(`✅ PASS: ${description} ${detail}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${description} ${detail}`);
      failed++;
    }
  }

  // Helper
  const post = (url, body) =>
    fetch(`${API}${url}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  const get = (url) => fetch(`${API}${url}`);

  const patch = (url, body) =>
    fetch(`${API}${url}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  const del = (url) => fetch(`${API}${url}`, { method: 'DELETE' });

  // 1. Create job
  const createRes = await post('/jobs', { title: 'Transcode Video', type: 'video' });
  const job1 = await createRes.json();
  assert(createRes.status === 201 && job1.id && job1.status === 'pending', '1. Create job (201 Created)', `ID: ${job1.id}`);

  // 2. Get jobs
  const getRes = await get('/jobs');
  const allJobs = await getRes.json();
  assert(getRes.status === 200 && Array.isArray(allJobs) && allJobs.length > 0, '2. Get jobs (200 OK)', `Count: ${allJobs.length}`);

  // 3. pending -> running
  const patchRunning = await patch(`/jobs/${job1.id}/status`, { status: 'running' });
  const job1Running = await patchRunning.json();
  assert(patchRunning.status === 200 && job1Running.status === 'running', '3. pending -> running (200 OK)');

  // 4. running -> completed
  const patchCompleted = await patch(`/jobs/${job1.id}/status`, { status: 'completed' });
  const job1Completed = await patchCompleted.json();
  assert(patchCompleted.status === 200 && job1Completed.status === 'completed', '4. running -> completed (200 OK)');

  // 5. running -> failed (create new job to test this)
  const createJob2 = await post('/jobs', { title: 'Send Email Blast', type: 'email' });
  const job2 = await createJob2.json();
  await patch(`/jobs/${job2.id}/status`, { status: 'running' });
  const patchFailed = await patch(`/jobs/${job2.id}/status`, { status: 'failed' });
  const job2Failed = await patchFailed.json();
  assert(patchFailed.status === 200 && job2Failed.status === 'failed', '5. running -> failed (200 OK)');

  // 6. pending -> completed ❌ (should be 409 Conflict)
  const createJob3 = await post('/jobs', { title: 'Pending Job', type: 'batch' });
  const job3 = await createJob3.json();
  const patchPendingToCompleted = await patch(`/jobs/${job3.id}/status`, { status: 'completed' });
  assert(patchPendingToCompleted.status === 409, '6. pending -> completed rejected (409 Conflict)', `Status: ${patchPendingToCompleted.status}`);

  // 7. completed -> running ❌ (should be 409 Conflict)
  const patchCompletedToRunning = await patch(`/jobs/${job1.id}/status`, { status: 'running' });
  assert(patchCompletedToRunning.status === 409, '7. completed -> running rejected (409 Conflict)', `Status: ${patchCompletedToRunning.status}`);

  // 8. failed -> running ❌ (should be 409 Conflict)
  const patchFailedToRunning = await patch(`/jobs/${job2.id}/status`, { status: 'running' });
  assert(patchFailedToRunning.status === 409, '8. failed -> running rejected (409 Conflict)', `Status: ${patchFailedToRunning.status}`);

  // 9. completed -> failed ❌ (should be 409 Conflict)
  const patchCompletedToFailed = await patch(`/jobs/${job1.id}/status`, { status: 'failed' });
  assert(patchCompletedToFailed.status === 409, '9. completed -> failed rejected (409 Conflict)', `Status: ${patchCompletedToFailed.status}`);

  // 10. Non-existent job
  const fakeId = '00000000-0000-0000-0000-000000000000';
  const patchNonExistent = await patch(`/jobs/${fakeId}/status`, { status: 'running' });
  assert(patchNonExistent.status === 404, '10. Non-existent job status update (404 Not Found)', `Status: ${patchNonExistent.status}`);

  // 11. Invalid status
  const patchInvalidStatus = await patch(`/jobs/${job3.id}/status`, { status: 'cancelled' });
  assert(patchInvalidStatus.status === 400, '11. Invalid status value (400 Bad Request)', `Status: ${patchInvalidStatus.status}`);

  // 12. Empty title
  const emptyTitleRes = await post('/jobs', { title: '   ', type: 'type' });
  assert(emptyTitleRes.status === 400, '12. Empty title rejected (400 Bad Request)', `Status: ${emptyTitleRes.status}`);

  // 13. Empty type
  const emptyTypeRes = await post('/jobs', { title: 'Some Title', type: '' });
  assert(emptyTypeRes.status === 400, '13. Empty type rejected (400 Bad Request)', `Status: ${emptyTypeRes.status}`);

  // 14. Direct API request bypassing React
  const directRes = await post('/jobs', { title: 'Direct API Job', type: 'curl' });
  assert(directRes.status === 201, '14. Direct API request bypassing React (201 Created)');

  // 15. CRITICAL CONCURRENCY: Two simultaneous requests attempting pending -> running
  console.log('\n--- Testing Critical Concurrency Requirement ---');
  const raceJobRes = await post('/jobs', { title: 'Race Job', type: 'concurrency-test' });
  const raceJob = await raceJobRes.json();
  console.log(`Created Job ${raceJob.id} in 'pending' status.`);

  // Fire both requests simultaneously
  const [resA, resB] = await Promise.all([
    patch(`/jobs/${raceJob.id}/status`, { status: 'running' }),
    patch(`/jobs/${raceJob.id}/status`, { status: 'running' }),
  ]);

  const statuses = [resA.status, resB.status].sort();
  console.log(`Simultaneous responses: Request 1 = ${resA.status}, Request 2 = ${resB.status}`);

  assert(
    statuses[0] === 200 && statuses[1] === 409,
    '15. Two simultaneous requests attempting pending -> running',
    `Exactly one 200 OK and one 409 Conflict (Got: ${statuses.join(', ')})`
  );

  // Clean up test: Delete a job
  const delRes = await del(`/jobs/${raceJob.id}`);
  assert(delRes.status === 200, 'Delete job endpoint (200 OK)');

  console.log(`\n========================================`);
  console.log(`TOTAL PASSED: ${passed}`);
  console.log(`TOTAL FAILED: ${failed}`);
  console.log(`========================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

testSuite().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
