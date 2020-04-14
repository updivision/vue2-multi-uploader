<template>
  <div class="uploadBox">
    <form role="form" enctype="multipart/form-data" @submit.prevent="onSubmit">
      <div class="uploadBoxMain" v-if="itemsAdded < 0">
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
        <div class="loader" v-if="isLoaderVisible">
          <div class="loaderImg"></div>
        </div>
      </div>
      <div class="uploadBoxMain" v-else>
        <p>
          <strong>Files</strong>
        </p>
        <ol>
          <li v-for="item in itemDetails" v-bind:key="item">
            <span v-bind:class="{ 'text-danger': item.filtered }">
              {{ item.name }} <br />
              {{ item.size }} <br />
              {{ item.hash.length === 64 ? item.hash : 'calculating hash' }}
            </span>
          </li>
        </ol>
        <p><strong>Total files:</strong> {{ itemsAdded }}</p>
        <p><strong>Total upload size:</strong> {{ itemsTotalSize }}</p>
        <div class="loader" v-if="isLoaderVisible">
          <div class="loaderImg"></div>
        </div>
      </div>
      <div>
        <button
          type="submit"
          class="btn btn-primary btn-black btn-round"
          :disabled="itemsAdded <= 0 || isLoaderVisible"
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
// require('es6-promise').polyfill()

var chunkSize = 1024 * 1024 // bytes
var timeout = 10 // millisec
var lastOffset = 0
var chunkReorder = 0
var chunkTotal = 0

// component: {
//   axios
// }
export default {
  props: {
    filterItemsUrl: {
      type: String,
      required: false
    },
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

  data () {
    return {
      dragging: false,
      items: [],
      itemDetails: [],
      formData: [],
      successMsg: '',
      errorMsg: '',
      isLoaderVisible: false
    }
  },

  computed: {
    itemsTotalSize: function () {
      return this.bytesToSize(
        this.itemDetails
          .filter(i => i.filtered !== true)
          .map(i => i.bytes)
          .reduce((a, b) => a + b, 0)
      )
    },
    itemsAdded: function () {
      if (this.itemDetails.length > 0) {
        return this.itemDetails.filter(i => i.filtered !== true).length
      } else {
        return -1
      }
    }
  },

  methods: {
    bytesToSize (bytes) {
      const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
      if (bytes === 0) return 'n/a'
      const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)))
      if (i === 0) return bytes + ' ' + sizes[i]
      return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + sizes[i]
    },

    onChange (e) {
      this.isLoaderVisible = true
      self = this
      this.successMsg = ''
      this.errorMsg = ''
      this.formData = new FormData()
      var localItems = []
      const files = e.target.files || e.dataTransfer.files
      for (const x in files) {
        if (!isNaN(x)) {
          this.items = e.target.files[x] || e.dataTransfer.files[x]
          this.itemDetails[x] = {
            name: files[x].name,
            bytes: files[x].size,
            size: this.bytesToSize(files[x].size),
            hash: this.hashFile(files[x]),
            filtered: null
          }
          // this.formData.append('items[]', this.items)
          localItems.push(this.items)
        }
      }
      const promises = this.itemDetails.map(i => i.hash)
      Promise.all(promises).then(function (values) {
        self.itemDetails.forEach((item, index) => {
          item.hash = values[index]
        })
        if (self.filterItemsUrl) {
          axios
            .post(
              self.filterItemsUrl,
              'X-Fotrino-Item-Details=' + JSON.stringify(self.itemDetails)
            )
            .then(filteredItems => {
              filteredItems.data.forEach((item, index) => {
                if (item.filtered !== true) {
                  self.formData.append('items[]', localItems[index])
                }
              })
              self.itemDetails = filteredItems.data
              self.isLoaderVisible = false
            })
        } else {
          self.isLoaderVisible = false
        }
      })
    },

    removeItems () {
      this.items = ''
      this.itemDetails = []
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
        lastOffset = reader.offset + reader.size
        callbackProgress(evt.target.result)
        if (reader.offset + reader.size >= file.size) {
          lastOffset = 0
          callbackFinal()
        }
        chunkTotal++
      } else {
        setTimeout(function () {
          self.callbackRead(reader, file, evt, callbackProgress, callbackFinal)
        }, timeout)
        chunkReorder++
      }
    },

    hashFile (file) {
      return new Promise((resolve, reject) => {
        if (file === undefined) {
          reject('undefined file object')
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
          },
          function (data) {
            var encrypted = SHA256.finalize().toString()
            resolve(encrypted)
          }
        )
      })
    },

    loading (file, callbackProgress, callbackFinal) {
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
