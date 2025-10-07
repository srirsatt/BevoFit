# generation of the tensorflow model, to get exported to .tflite for use within react-native
import os
import tensorflow as tf 
import numpy, pathlib, collections as np 
import matplotlib.pyplot as plt 
import kagglehub
from tensorflow.keras.applications.mobilenet_v3 import preprocess_input

# for now, will test with dogs and cat basic dataset. moving on to bench presses afterwards.
# for bench presses, simply import path rather than downloading from URL and importing from there
'''
_URL = 'https://storage.googleapis.com/mledu-datasets/cats_and_dogs_filtered.zip'
path_to_zip = tf.keras.utils.get_file('cats_and_dogs.zip', origin=_URL, extract=True)
PATH = os.path.join(os.path.dirname(path_to_zip), 'cats_and_dogs_filtered')
print(PATH)
'''
# bench press dataset
path = kagglehub.dataset_download("dutt2302/gym-equipment")
PATH = os.path.join(path, 'gym_data')
print(PATH)

# code above pulls dataset

data_dir = PATH
#train_dir = os.path.join(PATH, 'train')
#validation_dir = os.path.join(PATH, 'validation')

BATCH_SIZE = 32
IMG_SIZE = (224, 224) # px, px

train_dataset = tf.keras.utils.image_dataset_from_directory(
    data_dir,
    validation_split = 0.2,
    subset="training",
    seed=123,
    batch_size=BATCH_SIZE,
    image_size=IMG_SIZE
)
validation_dataset = tf.keras.utils.image_dataset_from_directory(
    data_dir,
    validation_split = 0.2,
    subset="validation",
    seed=123,
    image_size=IMG_SIZE,
    batch_size=BATCH_SIZE
)

class_names = train_dataset.class_names
num_classes = len(class_names)
print(class_names)


# pulls two datasets, for training and validation, defining batch size and img size (px)

'''
# optional show, first imgs of dataset
class_names = train.dataset.class_names


'''
# moving 20% to a train batch, dataset doesn't have. same with bench presses

val_batches = tf.data.experimental.cardinality(validation_dataset) # determines how much data is available for validation set
#test_dataset = validation_dataset.take(val_batches // 5) # // -> floor division operator
#validation_dataset = validation_dataset.skip(val_batches // 5)

print("Num val batches: %d" % tf.data.experimental.cardinality(validation_dataset))
#print("Num test batches %d" % tf.data.experimental.cardinality(test_dataset))


# autotune dataset, image loading performance benefit
AUTOTUNE = tf.data.AUTOTUNE
train_dataset = train_dataset.shuffle(1000).cache().prefetch(tf.data.AUTOTUNE)
validation_dataset = validation_dataset.cache().prefetch(tf.data.AUTOTUNE)
#test_dataset = test_dataset.prefetch(buffer_size=AUTOTUNE)


# data augmentation, for a smaller dataset. rotation, object movement, etc. 
# useful for bench dataset, and other datasets whre you will only have 50-100 imgs
data_augmentation = tf.keras.Sequential([
    tf.keras.layers.RandomFlip('horizontal'),  
    tf.keras.layers.RandomRotation(0.2),
    tf.keras.layers.RandomZoom(0.2),
    tf.keras.layers.RandomTranslation(0.1, 0.1),
    tf.keras.layers.RandomContrast(0.1), 
    tf.keras.layers.RandomBrightness(0.1),
])

# model rescaling (kinda like normalization in ML - [-1, 1] inputs)
preprocess_input = tf.keras.applications.mobilenet_v3.preprocess_input
rescale = tf.keras.layers.Rescaling(1./127.5, offset=-1)

# for now, pretrained convnets
# later, fine-tuned convnets - diff layers - real dataset
IMG_SHAPE = IMG_SIZE + (3,)
base_model = tf.keras.applications.MobileNetV3Large(input_shape=IMG_SHAPE, include_top=False, weights='imagenet')
base_model.trainable = False

image_batch, label_batch = next(iter(validation_dataset))
feature_batch = base_model(image_batch)
print(feature_batch.shape) # feature shape MobileNetV3 -> (32, 5, 5, 576)

base_model.summary()

print ("num layers in base: ", len(base_model.layers))

'''
fine_tune_layer = 100
for layer in base_model.layers[:fine_tune_layer]:
    layer.trainable = False
'''

global_average_layer = tf.keras.layers.GlobalAveragePooling2D() # 2d average pooling input signal conv neural net
feature_batch_avg = global_average_layer(feature_batch)
print(feature_batch_avg.shape)

prediction_layer = tf.keras.layers.Dense(1, activation="sigmoid")
prediction_batch = prediction_layer(feature_batch_avg)
print(prediction_batch.shape)

wd = 1e-5

inputs = tf.keras.Input(shape=IMG_SHAPE)
x = data_augmentation(inputs)
x = preprocess_input(x)
x = base_model(x)
x = global_average_layer(x)
x = tf.keras.layers.Dropout(0.2)(x)
x = tf.keras.layers.Dense(256, activation="relu", kernel_regularizer=tf.keras.regularizers.L2(wd))(x)
outputs = tf.keras.layers.Dense(num_classes, activation="softmax", kernel_regularizer=tf.keras.regularizers.L2(wd))(x)
model = tf.keras.Model(inputs, outputs)

model.summary()

# print diagram
tf.keras.utils.plot_model(model, show_shapes=True)

# compile, train over epochs
base_learning_rate = 0.0001 
model.compile(optimizer=tf.keras.optimizers.Adam(learning_rate = base_learning_rate), 
              loss=tf.keras.losses.SparseCategoricalCrossentropy(),
              metrics=['accuracy'])

epochs = 10 #subject to change
loss0, accuracy0 = model.evaluate(validation_dataset)

print("initial loss: {:.2f}".format(loss0))
print("initial accuracy: {:.2f}".format(accuracy0))

fine_tune_epochs = 20 + epochs

root = pathlib.Path(data_dir)
counts = {p.name: len(list(p.glob("*"))) for p in root.iterdir() if p.is_dir()}
print(counts)

idx = {name:i for i, name in enumerate(class_names)}
total = sum(counts.values())
class_weight = {idx[k]: total/(len(counts)*v) for k, v, in counts.items()}
print(class_weight)

# model training history
history = model.fit(train_dataset,
                    epochs=epochs,
                    validation_data=validation_dataset, class_weight=class_weight)

# fine tune set
fine_tune_at = int(0.7 * len(base_model.layers))
base_model.trainable = True
for layer in base_model.layers[:fine_tune_at]:
    layer.trainable = False

model.compile(
    optimizer=tf.keras.optimizers.Adam(learning_rate = base_learning_rate/10),
    loss=tf.keras.losses.SparseCategoricalCrossentropy(),
    metrics=['accuracy']
)

cb = [
    tf.keras.callbacks.ReduceLROnPlateau(monitor='val_loss', factor=0.5, patience=3),
    tf.keras.callbacks.EarlyStopping(monitor='val_loss', patience=6, restore_best_weights=True)
]

history_fine = model.fit(train_dataset,
                         epochs=fine_tune_epochs,
                         validation_data=validation_dataset,
                         initial_epoch=len(history.epoch),
                         callbacks=cb, class_weight=class_weight)

# testing with test dataset - in our case, we need to change this code for image verification over new image fed in.
loss, accuracy = model.evaluate(validation_dataset)
print(accuracy)

image_batch, label_batch = validation_dataset.as_numpy_iterator().next()
predictions = model.predict_on_batch(image_batch)
predictions = tf.argmax(predictions, axis=1).numpy()

print("Predictions:\n", predictions)
print("Labels (Real):\n", label_batch)



# print prediction diagram result 
plt.figure(figsize=(12, 12))
for i in range(9):
    ax = plt.subplot(3, 3, i + 1)
    plt.imshow(image_batch[i].astype("uint8"))
    pred_label = class_names[predictions[i]]
    true_label = class_names[label_batch[i]]
    color = "green" if predictions[i] == label_batch[i] else "red"
    plt.title(f"Pred: {pred_label}\nReal: {true_label}", color=color)
    plt.axis("off")

#plt.show()