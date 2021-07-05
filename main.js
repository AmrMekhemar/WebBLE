// Get references to UI elements
let connectButton = document.getElementById('connect');
let disconnectButton = document.getElementById('disconnect');
let readButton = document.getElementById('read');
let terminalContainer = document.getElementById('terminal');
let sendForm = document.getElementById('send-form');
let inputField = document.getElementById('input');
// Selected device object cache
let deviceCache = null;

// Connect to the device on Connect button click
connectButton.addEventListener('click', function() {
  connect();
});

// Disconnect from the device on Disconnect button click
disconnectButton.addEventListener('click', function() {
  disconnect();
});



// Handle form submit event
sendForm.addEventListener('submit', function(event) {
  event.preventDefault(); // Prevent form sending
  send(inputField.value); // Send text field contents
  inputField.value = '';  // Zero text field
  inputField.focus();     // Focus on text field
});

readButton.addEventListener('click', function() {
  let v= characteristicCache.readValue();
  let data = new TextDecoder().decode(v); 
  log(data,'out');
});




// Launch Bluetooth device chooser and connect to the selected
function connect() {
    return (deviceCache ? Promise.resolve(deviceCache) :
    requestBluetoothDevice()).
    then(device => connectDeviceAndCacheCharacteristic(device)).
   then(characteristic => characteristicCache = characteristic).
    catch(error => log(error));
}

function disconnect() {
    if (deviceCache) {
      log('Disconnecting from "' + deviceCache.name + '" bluetooth device...');
      deviceCache.removeEventListener('gattserverdisconnected',
          handleDisconnection);
  
      if (deviceCache.gatt.connected) {
        deviceCache.gatt.disconnect();
        log('"' + deviceCache.name + '" bluetooth device disconnected');
      }
      else {
        log('"' + deviceCache.name +
            '" bluetooth device is already disconnected');
      }
    }
  
    if (characteristicCache) {
    characteristicCache.removeEventListener('characteristicvaluechanged',
        handleCharacteristicValueChanged);
    characteristicCache = null;
  }
    deviceCache = null;
  }

function requestBluetoothDevice() {
    log('Requesting bluetooth device...');
    return navigator.bluetooth.requestDevice({
        // filters : [{
        //     name: 'TWI PAIRING DEMO'
        // }]
       acceptAllDevices: true,
       // 0x2A19
        // '1a7e4924-e3ed-4464-8b7e-751e03d0dc5f',0x1800,0x2A04,0x1801,0x16
        //'1a7e4924-e3ed-4464-8b7e-751e03d0dc5f',0x2A04,0x1800,0x2A00,0x2A01,0x1801,0x2A05,0x2902,0x0000,0x0010
       optionalServices: ["00001800-0000-1000-8000-00805f9b34fb",0x180F] // Required to access service later.
      })
      .
        then(device => {
          log('"' + device.name + '" bluetooth device selected');
          deviceCache = device;
          deviceCache.addEventListener('gattserverdisconnected',
            handleDisconnection);
  
          return deviceCache;
        });
  }
  
 // Characteristic object cache
let characteristicCache = null;

// Connect to the device specified, get service and characteristic
function connectDeviceAndCacheCharacteristic(device) {
  if (device.gatt.connected && characteristicCache) {
    return Promise.resolve(characteristicCache);
  }

  log('Connecting to GATT server...');

  return device.gatt.connect().
      then(server => {
        log('GATT server connected, getting service...');
        return server.getPrimaryService("00001800-0000-1000-8000-00805f9b34fb");
      }).
      then(service => {
        log('Service found, getting characteristic...');

        return service.getCharacteristic("00002a00-0000-1000-8000-00805f9b34fb");
      }).
      then(characteristic => {
        log('Characteristic found');
        characteristicCache = characteristic;

        return characteristicCache;
      });
}
  
  // Enable the characteristic changes notification
function startNotifications(characteristic) {
    log('Starting notifications...');
  
    return characteristic.startNotifications().
        then(() => {
          log('Notifications started');
          characteristic.addEventListener('characteristicvaluechanged',
            handleCharacteristicValueChanged);
        });
        
  }
  
  // Output to terminal
function log(data, type = '') {
    terminalContainer.insertAdjacentHTML('beforeend',
        '<div' + (type ? ' class="' + type + '"' : '') + '>' + data + '</div>');
  }


function handleDisconnection(event) {
    let device = event.target;
  
    log('"' + device.name +
        '" bluetooth device disconnected, trying to reconnect...');
  
    connectDeviceAndCacheCharacteristic(device).
        then(characteristic => startNotifications(characteristic)).
        catch(error => log(error));
  }

  // Data receiving
function handleCharacteristicValueChanged(event) {
    let value = new TextDecoder().decode(event.target.value);
    log(value, 'in');
  }


  function send(data) {
    data = String(data);
  
    if (!data || !characteristicCache) {
      return;
    }
  
    data += '\n';
  
    if (data.length > 20) {
      let chunks = data.match(/(.|[\r\n]){1,20}/g);
  
      writeToCharacteristic(characteristicCache, chunks[0]);
  
      for (let i = 1; i < chunks.length; i++) {
        setTimeout(() => {
          writeToCharacteristic(characteristicCache, chunks[i]);
        }, i * 100);
      }
    }
    else {
      writeToCharacteristic(characteristicCache, data);
    }
  
    log(data, 'out');
  }

  function writeToCharacteristic(characteristic, data) {
    characteristic.writeValue(new TextEncoder().encode(data));
  }