const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

if (isMainThread) {
  // Generate matrices A and B of size n x n
  const n = 1000;
  const A = generateMatrix(n);
  const B = generateMatrix(n);

  // Divide matrix A into p partitions
  const p = require('os').cpus().length;
  const blockSize = Math.ceil(n / p);
  const partitions = [];
  for (let i = 0; i < p; i++) {
    const start = i * blockSize;
    const end = Math.min(start + blockSize, n);
    partitions.push(A.slice(start, end));
  }

  // Create worker threads
  const workers = [];
  for (let i = 0; i < p; i++) {
    workers.push(new Worker(__filename, { workerData: { A: partitions[i], B } }));
  }

  // Synchronize partial products computed by worker threads
  let C = Array(n).fill().map(() => Array(n).fill(0));
  Promise.all(workers.map(worker => new Promise((resolve, reject) => {
    worker.on('message', message => {
      C = addMatrices(C, message);
      resolve();
    });
    worker.on('error', reject);
    worker.on('exit', code => {
      if (code !== 0) {
        reject(new Error(`Worker stopped with exit code ${code}`));
      }
    });
  })))
    .then(() => {
      console.log('Product computed');
    })
    .catch(error => {
      console.error(error);
    });
} else {
  // Compute partial product of A and B
  const { A, B } = workerData;
  const n = A.length;
  let C = Array(n).fill().map(() => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      for (let k = 0; k < n; k++) {
        C[i][j] += A[i][k] * B[k][j];
      }
    }
  }

  // Send partial product to main thread
  parentPort.postMessage(C);
}

function generateMatrix(n) {
  return Array(n).fill().map(() => Array(n).fill().map(() => Math.random()));
}

function addMatrices(A, B) {
  const n = A.length;
  const C = Array(n).fill().map(() => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      C[i][j] = A[i][j] + B[i][j];
    }
  }
  return C;
}
