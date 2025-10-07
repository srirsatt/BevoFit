import tensorflow as tf
# to check M4 chip utilization.
print("TF:", tf.__version__)
print("Built with GPU:", tf.test.is_built_with_gpu_support())
print("Physical devices:", tf.config.list_physical_devices())
print("Logical devices:", tf.config.list_logical_devices())