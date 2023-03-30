import numpy as np
import matplotlib.pyplot as plt
from lab_utils_multi import zscore_normalize_features, run_gradient_descent_feng

np.set_printoptions(precision=2)  # reduced display precision on numpy arrays

x = np.arange(0, 20, 1)
y = 1 + x ** 2
X = np.c_[x, x**2, x**3]
X = X.reshape(-1, 1)
print(f"x value is %v", x)
print(f"X value is %v", X)
model_w, model_b = run_gradient_descent_feng(X, y, iterations=1000, alpha=1e-2)
plt.scatter(x, y, marker='x', c='r', label="Actual value")
plt.title("no Feature engineering")
plt.plot(x, X @ model_w + model_b, label="Predicted Value")
plt.xlabel("X")
plt.ylabel("y")
plt.legend()
plt.show()


