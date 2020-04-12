<template>
  <div class="uploadBox">
    <form role="form" enctype="multipart/form-data" @submit.prevent="onSubmit">
      <div class="uploadBoxMain" v-if="!itemsAdded">
        <div class="form-group">
          <div
            class="dropArea"
            @ondragover="onChange"
            :class="dragging ? 'dropAreaDragging' : ''"
            @dragenter="dragging = true"
            @dragend="dragging = false"
            @dragleave="dragging = false"
          >
            <p>Drag files here, or click, to upload.</p>
            <input
              type="file"
              id="items"
              name="items[]"
              required
              multiple
              @change="onChange"
            />
          </div>
        </div>
      </div>
      <div class="uploadBoxMain" v-else>
        <p>
          <strong>Files</strong>
        </p>
        <ol>
          <li v-for="item in itemDetails" v-bind:key="item">
            {{ item.name }} ({{ item.size }}) <br />
            {{ item.hash }}
          </li>
        </ol>
        <p><strong>Total files:</strong> {{ itemsAdded }}</p>
        <p><strong>Total upload size:</strong> {{ itemsTotalSize }}</p>
        <button @click="removeItems">Remove files</button>
        <div class="loader" v-if="isLoaderVisible">
          <div class="loaderImg"></div>
        </div>
      </div>
      <div>
        <button
          type="submit"
          class="btn btn-primary btn-black btn-round"
          :disabled="!itemsAdded"
        >
          Upload
        </button>
        <button
          type="button"
          class="btn btn-default btn-round"
          @click="removeItems"
        >
          Cancel
        </button>
      </div>
      <br />
      <div class="successMsg" v-if="successMsg !== ''">
        Files successfully uploaded!
      </div>
      <div class="errorMsg" v-if="errorMsg !== ''">
        Uh oh, something went wrong!
      </div>
    </form>
  </div>
</template>

<script>
import axios from 'axios'
import CryptoJS from 'crypto-js'
require('es6-promise').polyfill()

var chunkSize = 1024 * 1024 // bytes
var timeout = 10 // millisec
var lastOffset = 0
var chunkReorder = 0
var chunkTotal = 0

component: {
  axios
}
export default {
  props: {
    postURL: {
      type: String,
      required: true
    },
    method: {
      type: String,
      default: 'post'
    },
    postMeta: {
      type: [String, Array, Object],
      default: ''
    },
    postData: {
      type: [Object],
      default: () => {}
    },
    postHeader: {
      type: [Object],
      default: () => {}
    },
    successMessagePath: {
      type: String,
      required: true
    },
    errorMessagePath: {
      type: String,
      required: true
    },
    headerMessage: {
      type: String,
      default: 'Add files'
    },
    showHttpMessages: {
      type: Boolean,
      default: true
    }
  },

  /*
   * The component's data.
   */
  data () {
    return {
      dragging: false,
      items: [],
      itemsAdded: '',
      itemDetails: [],
      itemsTotalSize: '',
      formData: '',
      successMsg: '',
      errorMsg: '',
      isLoaderVisible: false
    }
  },

  methods: {
    // http://scratch99.com/web-development/javascript/convert-bytes-to-mb-kb/
    bytesToSize (bytes) {
      const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
      if (bytes === 0) return 'n/a'
      const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)))
      if (i === 0) return bytes + ' ' + sizes[i]
      return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + sizes[i]
    },

    onChange (e) {
      this.successMsg = ''
      this.errorMsg = ''
      this.formData = new FormData()
      const files = e.target.files || e.dataTransfer.files
      this.itemsAdded = files.length
      let fileSizes = 0
      for (const x in files) {
        if (!isNaN(x)) {
          this.items = e.target.files[x] || e.dataTransfer.files[x]
          var fileHash = this.hashFile(files[x])
          this.itemDetails[x] = {
            name: files[x].name,
            size: this.bytesToSize(files[x].size),
            hash: '000000'
          }
          fileSizes += files[x].size
          this.formData.append('items[]', this.items)
        }
      }
      this.itemsTotalSize = this.bytesToSize(fileSizes)
    },

    removeItems () {
      this.items = ''
      this.itemsAdded = ''
      this.itemDetails = []
      this.itemsTotalSize = ''
      this.dragging = false
    },

    onSubmit () {
      this.isLoaderVisible = true

      if (
        (typeof this.postMeta === 'string' && this.postMeta !== '') ||
        (typeof this.postMeta === 'object' &&
          Object.keys(this.postMeta).length > 0)
      ) {
        this.formData.append('postMeta', this.postMeta)
      }

      if (
        typeof this.postData === 'object' &&
        this.postData !== null &&
        Object.keys(this.postData).length > 0
      ) {
        for (var key in this.postData) {
          this.formData.append(key, this.postData[key])
        }
      }

      if (this.method === 'put' || this.method === 'post') {
        axios({
          method: this.method,
          url: this.postURL,
          data: this.formData,
          headers: this.postHeader
        })
          .then(response => {
            this.isLoaderVisible = false
            // Show success message
            if (this.showHttpMessages) {
              this.successMsg = response.data
            }
            this.removeItems()
          })
          .catch(error => {
            this.isLoaderVisible = false
            if (this.showHttpMessages) {
              this.errorMsg = error
            }
            this.removeItems()
          })
      } else {
        if (this.showHttpMessages) this.errorMsg = this.httpMethodErrorMessage
        this.removeItems()
      }
    },
    // Hashing!

    // time reordering
    callbackRead (reader, file, evt, callbackProgress, callbackFinal) {
      self = this
      if (lastOffset === reader.offset) {
        // console.log(
        //   '[',
        //   reader.size,
        //   ']',
        //   reader.offset,
        //   '->',
        //   reader.offset + reader.size,
        //   ''
        // )
        lastOffset = reader.offset + reader.size
        callbackProgress(evt.target.result)
        if (reader.offset + reader.size >= file.size) {
          lastOffset = 0
          callbackFinal()
        }
        chunkTotal++
      } else {
        // console.log(
        //   '[',
        //   reader.size,
        //   ']',
        //   reader.offset,
        //   '->',
        //   reader.offset + reader.size,
        //   'wait'
        // )
        setTimeout(function () {
          self.callbackRead(reader, file, evt, callbackProgress, callbackFinal)
        }, timeout)
        chunkReorder++
      }
    },

    hashFile (file) {
      if (file === undefined) {
        return
      }
      var SHA256 = CryptoJS.algo.SHA256.create()
      var counter = 0
      var self = this

      this.loading(
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
          console.log('HASH: ' + encrypted)
        }
      )
    },

    // clear () {
    //   lastOffset = 0
    //   chunkReorder = 0
    //   chunkTotal = 0
    // },

    loading (file, callbackProgress, callbackFinal) {
      // var chunkSize  = 1024*1024; // bytes
      var offset = 0
      var size = chunkSize
      var partial
      var index = 0

      self = this

      if (file.size === 0) {
        this.callbackFinal()
      }
      while (offset < file.size) {
        partial = file.slice(offset, offset + size)
        var reader = new FileReader()
        reader.size = chunkSize
        reader.offset = offset
        reader.index = index
        reader.onload = function (evt) {
          self.callbackRead(this, file, evt, callbackProgress, callbackFinal)
        }
        reader.readAsArrayBuffer(partial)
        offset += chunkSize
        index += 1
      }
    }

    // Array.prototype.remove =
    //   Array.prototype.remove ||
    //   function (val) {
    //     var i = this.length
    //     while (i--) {
    //       if (this[i] === val) {
    //         this.splice(i, 1)
    //       }
    //     }
    //   }

    // humanFileSize (bytes, si) {
    //   var thresh = si ? 1000 : 1024
    //   if (Math.abs(bytes) < thresh) {
    //     return bytes + ' B'
    //   }
    //   var units = si
    //     ? ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
    //     : ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB']
    //   var u = -1
    //   do {
    //     bytes /= thresh
    //     ++u
    //   } while (Math.abs(bytes) >= thresh && u < units.length - 1)
    //   return bytes.toFixed(1) + ' ' + units[u]
    // }
  }
}
</script>

<style>
.uploadBox {
  position: relative;
  background: #eee;
  padding: 0 1em 1em 1em;
  margin: 1em;
}

.uploadBox h3 {
  padding-top: 1em;
}

.uploadBox .uploadBoxMain {
  position: relative;
  margin-bottom: 1em;
  margin-right: 1em;
}

/* Drag and drop */
.uploadBox .dropArea {
  position: relative;
  width: 100%;
  height: 300px;
  border: 5px dashed #00adce;
  text-align: center;
  font-size: 2em;
  padding-top: 80px;
}

.uploadBox .dropArea input {
  position: absolute;
  cursor: pointer;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
}
/* End drag and drop */

/* Loader */
.uploadBox .loader {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #fff;
  opacity: 0.9;
}

.uploadBox .loaderImg {
  border: 9px solid #eee;
  border-top: 9px solid #00adce;
  border-radius: 50%;
  width: 70px;
  height: 70px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
/* End Loader */

.uploadBox .errorMsg {
  font-size: 2em;
  color: #a94442;
}

.uploadBox .successMsg {
  font-size: 2em;
  color: #3c763d;
}
</style>
