import json
import random

from flask import Flask
from flask import jsonify
from miio.viomivacuum import *
from miio.exceptions import DeviceException

app = Flask(__name__)

with open('config.json') as f:
    config = json.load(f)

vacuum = ViomiVacuum(
    ip=config['ip'],
    token=config['token'],
    start_id=random.randrange(9000)
    )

@app.errorhandler(DeviceException)
def handle_device_exception(e):
    return jsonify({"exception": str(e)}), 200

@app.route('/')
def hello_world():
    return 'Hello, World!'

@app.route('/status')
def status():
    status = vacuum.status().data
    status['battery_life'] = status['battary_life']
    del status['battary_life']
    status['done'] = True
    return jsonify(status)

@app.route('/home')
def home():
    vacuum.home()
    return jsonify({"done": True})

@app.route('/pause')
def pause():
    vacuum.pause()
    return jsonify({"done": True})

@app.route('/start')
def start():
    vacuum.start()
    return jsonify({"done": True})

@app.route('/watergrade/<int:grade>')
def set_water_grade(grade: int):
    if not 11 <= grade <= 13:
        return jsonify({"exception": "water grade not supported"}), 400
    
    vacuum.set_water_grade(ViomiWaterGrade(grade))
    return jsonify({"done": True})
    
@app.route('/fanspeed/<int:speed>')
def set_fan_speed(speed: int):
    if not 0 <= speed <= 3:
        return jsonify({"exception": "fan speed not supported"}), 400
    
    vacuum.set_fan_speed(ViomiVacuumSpeed(speed))
    return jsonify({"done": True})

@app.route('/cleanmode/<int:mode>')
def set_mode(mode: int):
    if not 0 <= mode <= 2:
        return jsonify({"exception": "clean mode not supported"}), 400
    
    vacuum.clean_mode(ViomiMode(mode))
    return jsonify({"done": True})