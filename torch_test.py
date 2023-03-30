import torch
from torch import nn

import matplotlib.pyplot as plt

weight = 0.7
bias = 0.3

start = 0
end = 1
step = 0.02

X = torch.arange(start, end, step).unsqueeze(dim=1)
y = weight * X + bias

train_split = int(0.8 * len(X))
X_train, y_train = X[:train_split], y[:train_split]
X_test, y_test = X[train_split:], y[train_split:]

plt.figure(figsize=(10, 7))
plt.scatter(X_train, y_train, c="b", s=4, label="training data")
plt.scatter(X_test, y_test, c="g", s=4, label="test data")


# plt.show()


class LinearRegressionModel(nn.Module):
    def __init__(self):
        super().__init__()
        self.weight = nn.Parameter(torch.randn(1, requires_grad=True, dtype=torch.float))
        self.bias = nn.Parameter(torch.randn(1, requires_grad=True, dtype=torch.float))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.weight * x + self.bias


torch.manual_seed(42)

model_0 = LinearRegressionModel()
lost_fn = nn.L1Loss()

optimizer = torch.optim.SGD(params=model_0.parameters(), lr=0.01)

# loops through the data
epochs = 100
y_pred = None
print(model_0.state_dict())
for epoch in range(epochs):
    model_0.train()
    y_pred = model_0(X_train)
    loss = lost_fn(y_pred, y_train)
    print(f'the lost {loss}', )
    optimizer.zero_grad()
    loss.backward()
    optimizer.step()
    model_0.eval()

print(model_0.state_dict())
