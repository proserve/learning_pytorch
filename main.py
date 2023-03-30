import math, copy
import numpy as np
import matplotlib.pyplot as plt

plt.style.use('./deeplearning.mplstyle')
from lab_utils_uni import plt_house_x, plt_contour_wgrad, plt_divergence, plt_gradients

x_train = np.array([1.0, 2.0])
y_train = np.array([300.0, 500.0])


def compute_cost(x, y, w, b):
    m = x.shape[0]
    cost = 0
    for i in range(m):
        f_wb = w * x[i] + b
        cost += (f_wb - y[i]) ** 2
    total_cost = cost / (2 * m)

    return total_cost


def compute_gradient(x, y, w, b):
    m = x.shape[0]
    dj_dw = 0
    dj_db = 0

    for i in range(m):
        f_wb = w * x[i] + b
        dj_dw += (f_wb - y[i]) * x[i]
        dj_db += f_wb - y[i]
    dj_db /= m
    dj_dw /= m
    return dj_dw, dj_db


plt_gradients(x_train, y_train, compute_cost, compute_gradient)
plt.show()


def gradient_decent(x, y, w_in, b_in, alpha, num_iters, cost_function, gradient_function):
    j_history = []
    p_history = []

    w = w_in
    b = b_in

    for i in range(num_iters):
        dj_dw, dj_db = gradient_function(x, y, w, b)
        w -= alpha * dj_dw
        b -= alpha * dj_db

        if i < 10e6:
            j_history.append(cost_function(x, y, w, b))
            p_history.append([w, b])
        # Print cost every at intervals 10 times or as many iterations if < 10
        if i % math.ceil(num_iters / 10) == 0:
            print(f"Iteration {i:4}: Cost {j_history[-1]:0.2e} ",
                  f"dj_dw: {dj_dw: 0.3e}, dj_db: {dj_db: 0.3e}  ",
                  f"w: {w: 0.3e}, b:{b: 0.5e}")
    return w, b, j_history, p_history


w_init = 0
b_init = 0
iteration = 10000
alpha = 1e-2

final_w, final_b, j_hist, p_hist = gradient_decent(x_train, y_train, b_init, w_init, alpha, iteration, compute_cost,
                                                   compute_gradient)

print(f"(w,b) found by gradient descent: ({final_w:8.4f},{final_b:8.4f})")
# plot cost versus iteration
fig, (ax1, ax2) = plt.subplots(1, 2, constrained_layout=True, figsize=(12, 4))
ax1.plot(j_hist[:100])
ax2.plot(1000 + np.arange(len(j_hist[1000:])), j_hist[1000:])
ax1.set_title("Cost vs. iteration(start)");
ax2.set_title("Cost vs. iteration (end)")
ax1.set_ylabel('Cost');
ax2.set_ylabel('Cost')
ax1.set_xlabel('iteration step');
ax2.set_xlabel('iteration step')
plt.show()


plt_divergence(p_hist, j_hist,x_train, y_train)
plt.show()