from roboflow import Roboflow

rf = Roboflow(api_key="o2ZgCrQKDhHa4aojAAOX")

# Correct project identifier: microplastics-03kqm
project = rf.workspace("kkk-cpyyf").project("microplastics-03kqm")
dataset = project.version(1).download("yolov8")

print("\n[HydroLens] Microplastics dataset download finished successfully!")