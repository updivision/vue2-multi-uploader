var chunkSize = 1024 * 1024 // bytes
var timeout = 10 // millisec

function handleFile (file) {
  if (file === undefined) {
    return
  }
  var SHA256 = CryptoJS.algo.SHA256.create()
  var counter = 0
  var self = this

  var timeStart = new Date().getTime()
  var timeEnd = 0

  loading(
    file,
    function (data) {
      var wordBuffer = CryptoJS.lib.WordArray.create(data)
      SHA256.update(wordBuffer)
      counter += data.byteLength
      // console.log((( counter / file.size)*100).toFixed(0) + '%');
    },
    function (data) {
      // console.log('100%');
      var encrypted = SHA256.finalize().toString()
      console.log('HASH: ' + encryptd)
    }
  )
}

function clear () {
  lastOffset = 0
  chunkReorder = 0
  chunkTotal = 0
}

function loading (file, callbackProgress, callbackFinal) {
  // var chunkSize  = 1024*1024; // bytes
  var offset = 0
  var size = chunkSize
  var partial
  var index = 0

  if (file.size === 0) {
    callbackFinal()
  }
  while (offset < file.size) {
    partial = file.slice(offset, offset + size)
    var reader = new FileReader()
    reader.size = chunkSize
    reader.offset = offset
    reader.index = index
    reader.onload = function (evt) {
      callbackRead(this, file, evt, callbackProgress, callbackFinal)
    }
    reader.readAsArrayBuffer(partial)
    offset += chunkSize
    index += 1
  }
}

function callbackRead (obj, file, evt, callbackProgress, callbackFinal) {
  callbackRead_waiting(obj, file, evt, callbackProgress, callbackFinal)
}

var lastOffset = 0
var chunkReorder = 0
var chunkTotal = 0
// time reordering
function callbackRead_waiting (
  reader,
  file,
  evt,
  callbackProgress,
  callbackFinal
) {
  if (lastOffset === reader.offset) {
    console.log(
      '[',
      reader.size,
      ']',
      reader.offset,
      '->',
      reader.offset + reader.size,
      ''
    )
    lastOffset = reader.offset + reader.size
    callbackProgress(evt.target.result)
    if (reader.offset + reader.size >= file.size) {
      lastOffset = 0
      callbackFinal()
    }
    chunkTotal++
  } else {
    console.log(
      '[',
      reader.size,
      ']',
      reader.offset,
      '->',
      reader.offset + reader.size,
      'wait'
    )
    setTimeout(function () {
      callbackRead_waiting(reader, file, evt, callbackProgress, callbackFinal)
    }, timeout)
    chunkReorder++
  }
}

Array.prototype.remove =
  Array.prototype.remove ||
  function (val) {
    var i = this.length
    while (i--) {
      if (this[i] === val) {
        this.splice(i, 1)
      }
    }
  }

// Human file size
function humanFileSize (bytes, si) {
  var thresh = si ? 1000 : 1024
  if (Math.abs(bytes) < thresh) {
    return bytes + ' B'
  }
  var units = si
    ? ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
    : ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB']
  var u = -1
  do {
    bytes /= thresh
    ++u
  } while (Math.abs(bytes) >= thresh && u < units.length - 1)
  return bytes.toFixed(1) + ' ' + units[u]
}
