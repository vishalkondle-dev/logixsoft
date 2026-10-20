import { CornerPoint } from '../types';

/**
 * Computes the 4x4 homography transform matrix for CSS `matrix3d(...)`.
 * Transforms an image of (width, height) to match 4 arbitrary corner points:
 * corners = [topLeft, topRight, bottomRight, bottomLeft]
 */
export function computeHomographyMatrix(
  w: number,
  h: number,
  corners: [CornerPoint, CornerPoint, CornerPoint, CornerPoint]
): string {
  // Source points (original image rectangle)
  const x0 = 0, y0 = 0;
  const x1 = w, y1 = 0;
  const x2 = w, y2 = h;
  const x3 = 0, y3 = h;

  // Destination points
  const [u0, u1, u2, u3] = [corners[0].x, corners[1].x, corners[2].x, corners[3].x];
  const [v0, v1, v2, v3] = [corners[0].y, corners[1].y, corners[2].y, corners[3].y];

  // We solve system of linear equations:
  // [ x_i  y_i  1   0    0   0  -x_i*u_i  -y_i*u_i ] [ h0 ]   [ u_i ]
  // [  0    0   0  x_i  y_i  1  -x_i*v_i  -y_i*v_i ] [ h1 ] = [ v_i ]
  // for 4 points, with h8 = 1.
  
  const A: number[][] = [
    [x0, y0, 1, 0, 0, 0, -x0 * u0, -y0 * u0],
    [0, 0, 0, x0, y0, 1, -x0 * v0, -y0 * v0],
    [x1, y1, 1, 0, 0, 0, -x1 * u1, -y1 * u1],
    [0, 0, 0, x1, y1, 1, -x1 * v1, -y1 * v1],
    [x2, y2, 1, 0, 0, 0, -x2 * u2, -y2 * u2],
    [0, 0, 0, x2, y2, 1, -x2 * v2, -y2 * v2],
    [x3, y3, 1, 0, 0, 0, -x3 * u3, -y3 * u3],
    [0, 0, 0, x3, y3, 1, -x3 * v3, -y3 * v3],
  ];

  const B: number[] = [u0, v0, u1, v1, u2, v2, u3, v3];

  const H = solveGaussian(A, B);
  if (!H) {
    return 'matrix3d(1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1)';
  }

  // CSS matrix3d is column-major:
  // [h0, h3, 0, h6]
  // [h1, h4, 0, h7]
  // [ 0,  0, 1,  0]
  // [h2, h5, 0,  1]
  const [h0, h1, h2, h3, h4, h5, h6, h7] = H;

  return `matrix3d(${h0}, ${h3}, 0, ${h6}, ${h1}, ${h4}, 0, ${h7}, 0, 0, 1, 0, ${h2}, ${h5}, 0, 1)`;
}

/**
 * Standard Gaussian elimination solver for 8x8 matrix
 */
function solveGaussian(A: number[][], B: number[]): number[] | null {
  const n = B.length;
  for (let i = 0; i < n; i++) {
    // Find pivot
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(A[k][i]) > Math.abs(A[maxRow][i])) {
        maxRow = k;
      }
    }
    // Swap rows
    [A[i], A[maxRow]] = [A[maxRow], A[i]];
    [B[i], B[maxRow]] = [B[maxRow], B[i]];

    if (Math.abs(A[i][i]) < 1e-12) return null; // Singular

    for (let k = i + 1; k < n; k++) {
      const c = -A[k][i] / A[i][i];
      for (let j = i; j < n; j++) {
        if (i === j) {
          A[k][j] = 0;
        } else {
          A[k][j] += c * A[i][j];
        }
      }
      B[k] += c * B[i];
    }
  }

  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = 0;
    for (let j = i + 1; j < n; j++) {
      sum += A[i][j] * x[j];
    }
    x[i] = (B[i] - sum) / A[i][i];
  }
  return x;
}
