import copy, math

import numpy
import numpy as np
import matplotlib.pyplot as plt

plt.style.use('./deeplearning.mplstyle')
np.set_printoptions(precision=2)  # reduced display precision on numpy arrays

X_train = np.array([[2104, 5, 1, 45], [1416, 3, 2, 40], [852, 2, 1, 35]])
y_train = np.array([460, 232, 178])

# data is stored in numpy array/matrix
print(f"X Shape: {X_train.shape}, X Type:{type(X_train)})")
print(X_train)
print(f"y Shape: {y_train.shape}, y Type:{type(y_train)})")
print(y_train)

b_init = 785.1811367994083
w_init = np.array([0.39133535, 18.75376741, -53.36032453, -26.42131618])
print(f"w_init shape: {w_init.shape}, b_init type: {type(b_init)}")


def compute_cost(X, y, w, b):
    cost = 0.0
    m = X.shape[0]
    for i in range(m):
        f_wb_i = numpy.dot(X[i], w) + b
        cost += (f_wb_i - y[i]) ** 2
    return cost / (2 * m)


print(f'Cost at optimal w : {compute_cost(X_train, y_train, w_init, b_init)}')
