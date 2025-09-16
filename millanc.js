/**
 * Millanc: Make Image Look Like A Neovim Colorscheme
 *
 * This is a single file JavaScript application that
 * renders images in the style of Neovim colorschemes.
 * All the work is done in the browser, using
 * the HTML5 canvas element and web workers.
 *
 * It would be a couple hundred lines of code, except that
 * the palettes object is huge.
 *
 * Anyway, enjoy!
 *
 * Tom
 */

document.addEventListener("DOMContentLoaded", function () {
    config.num_workers = navigator.hardwareConcurrency
        ? navigator.hardwareConcurrency - 1
        : 1

    render()
})

const config = {
    num_workers: 7,
    buttons: {
        upload: "Upload Image",
        clear: "Clear",
        download: "Download",
    },
    palettes: palettes(),
}

let state = freshState()

function makeSearchableDropdown() {
    let container = document.createElement("div")
    container.className = "searchable-dropdown"

    let input = document.createElement("input")
    input.className = "dropdown-input"
    input.type = "text"
    input.placeholder =
        state.currentPalette === "original"
            ? "Choose a palette"
            : state.currentPalette

    let dropdown = document.createElement("div")
    dropdown.className = "dropdown-list"
    dropdown.style.display = "none"

    let options = Object.keys(config.palettes)
        .map((name) => ({
            value: name,
            text: state.cache[name] ? name + " ✔︎" : name,
        }))
        .sort((a, b) => a.text.localeCompare(b.text))
    options.unshift({ value: "original", text: "original" })

    let selectedIndex = -1

    function renderOptions(filter = "") {
        dropdown.innerHTML = ""
        selectedIndex = -1
        let filtered = options.filter((opt) =>
            opt.text.toLowerCase().includes(filter.toLowerCase())
        )

        filtered.forEach((opt) => {
            let item = document.createElement("div")
            item.className = "dropdown-item"
            item.textContent = opt.text
            item.addEventListener("click", () => selectOption(opt))
            dropdown.appendChild(item)
        })

        return filtered
    }

    function selectOption(opt) {
        state.currentPalette = opt.value
        state.searchTerm = input.value
        input.value = opt.text
        dropdown.style.display = "none"

        if (state.currentPalette === "original") {
            state.convertedImage = state.uploadedImage
            render()
            return
        }
        if (state.uploadedImage) {
            convertImage()
        }
    }

    function updateSelection() {
        dropdown.querySelectorAll(".dropdown-item").forEach((item, index) => {
            item.classList.toggle("selected", index === selectedIndex)
        })
    }

    input.addEventListener("focus", () => {
        dropdown.style.display = "block"
        input.value = state.searchTerm
        renderOptions(input.value)
        updateSelection()
    })

    input.addEventListener("input", (e) => {
        dropdown.style.display = "block"
        renderOptions(e.target.value)
        updateSelection()
    })

    input.addEventListener("blur", () =>
        setTimeout(() => (dropdown.style.display = "none"), 200)
    )

    input.addEventListener("keydown", (e) => {
        let filtered = options.filter((opt) =>
            opt.text.toLowerCase().includes(input.value.toLowerCase())
        )

        if (e.key === "ArrowDown") {
            e.preventDefault()
            selectedIndex = Math.min(selectedIndex + 1, filtered.length - 1)
            updateSelection()
        } else if (e.key === "ArrowUp") {
            e.preventDefault()
            selectedIndex = Math.max(selectedIndex - 1, -1)
            updateSelection()
        } else if (e.key === "Enter") {
            e.preventDefault()
            if (selectedIndex >= 0 && filtered[selectedIndex]) {
                selectOption(filtered[selectedIndex])
            }
        } else if (e.key === "Escape") {
            dropdown.style.display = "none"
            input.blur()
        }
    })

    renderOptions()
    container.appendChild(input)
    container.appendChild(dropdown)

    return container
}

/**
 * Makes a style element with all the CSS needed.
 * CSS is scoped to #millanc to avoid conflicts.
 */
function makeStyle() {
    let style = document.createElement("style")
    style.textContent = `
#millanc {
  /* === Default theme variables === */
  --millanc-bg: rgba(240, 240, 240, 0.9);
  --millanc-fg: #111;
  --millanc-border: rgba(0, 0, 0, 0.2);
  --millanc-radius: 6px;
  --millanc-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);

  font-family: inherit;
  color: var(--millanc-fg);

  /* === Dark mode overrides === */
  @media (prefers-color-scheme: dark) {
    --millanc-bg: rgba(51, 51, 51, 0.8);
    --millanc-fg: #fff;
    --millanc-border: rgba(255, 255, 255, 0.2);
    --millanc-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
  }
}

/* === Canvas styling === */
#millanc canvas {
  display: block;
  max-width: 100%;
  max-height: 80vh;
  width: auto;
  height: auto;
  margin: 0 auto;
  border-radius: var(--millanc-radius);
  border: 2px solid var(--millanc-border);
  box-shadow: var(--millanc-shadow);
  transition: all 0.2s ease;
}

#millanc canvas.processing {
  filter: blur(5px) brightness(0.7);
  border-color: var(--millanc-border);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

/* === Control panel === */
#millanc #millanc-control-panel {
  margin-bottom: 10px;
  gap: 10px;
  display: flex;
  flex-wrap: wrap;
}

/* === Buttons === */
#millanc button {
  font: inherit;
  color: var(--millanc-fg);
  background-color: var(--millanc-bg);
  padding: 0.5rem 1rem;
  border: 1px solid var(--millanc-border);
  border-radius: var(--millanc-radius);
  cursor: pointer;
  transition: all 0.2s ease;
}
#millanc button:hover {
  filter: brightness(1.1);
}

/* === Selects === */
#millanc select {
  font: inherit;
  color: var(--millanc-fg);
  background-color: var(--millanc-bg);
  border: 1px solid var(--millanc-border);
  border-radius: var(--millanc-radius);
  appearance: none;
  padding: 0.5rem 2.5rem 0.5rem 0.75rem;
  background-image: url("data:image/svg+xml;utf8,<svg fill='currentColor' xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M7 10l5 5 5-5z'/></svg>");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  cursor: pointer;
  transition: all 0.2s ease;
}
#millanc select:hover {
  filter: brightness(1.1);
}

/* === Searchable dropdown === */
#millanc .searchable-dropdown {
  position: relative;
  display: inline-block;
}
#millanc .searchable-dropdown .dropdown-input {
  font: inherit;
  color: var(--millanc-fg);
  background-color: var(--millanc-bg);
  border: 1px solid var(--millanc-border);
  border-radius: var(--millanc-radius);
  outline: none;
  cursor: pointer;
  min-width: 300px;
  padding: 0.5rem 0.75rem;
  transition: all 0.2s ease;
}
#millanc .searchable-dropdown .dropdown-input::placeholder {
  color: var(--millanc-fg);
  opacity: 0.6;
}
#millanc .searchable-dropdown .dropdown-input:hover {
  filter: brightness(1.1);
}
#millanc .searchable-dropdown .dropdown-list {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 1000;
  background-color: var(--millanc-bg);
  border: 1px solid var(--millanc-border);
  border-radius: var(--millanc-radius);
  max-height: 300px;
  overflow-y: auto;
  box-shadow: var(--millanc-shadow);
}
#millanc .searchable-dropdown .dropdown-item {
  padding: 0.5rem 0.75rem;
  color: var(--millanc-fg);
  cursor: pointer;
  border-bottom: 1px solid var(--millanc-border);
}
#millanc .searchable-dropdown .dropdown-item:hover,
#millanc .searchable-dropdown .dropdown-item.selected {
  background-color: rgba(0, 0, 0, 0.1);
}
#millanc .searchable-dropdown .dropdown-item:last-child {
  border-bottom: none;
}

/* === Progress overlay === */
#millanc #millanc-progress {
  font-size: 50px;
  text-shadow: 0 0 5px black;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 10;
}
`
    return style
}

function makeCanvas() {
    let canvas = document.createElement("canvas")
    let image = state.convertedImage ?? state.uploadedImage

    // If no image, make a default size canvas.
    if (!image) {
        let width = Math.max(100, state.millancContainer.offsetWidth)
        canvas.width = width
        canvas.height = Math.floor(width / 4)
        return canvas
    }

    canvas.width = image.width
    canvas.height = image.height
    let ctx = canvas.getContext("2d")
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    return canvas
}

/**
 * The control panel is made from scratch each time.
 * It's rendered based on the current state. If the user
 * hasn't uploaded an image yet, only the upload button is shown.
 */
function makeControlPanel() {
    let controlPanel = document.createElement("div")
    controlPanel.id = "millanc-control-panel"

    if (!state.uploadedImage) {
        let uploadButton = document.createElement("button")
        uploadButton.id = "millanc-upload-button"
        uploadButton.textContent = config.buttons.upload
        uploadButton.addEventListener("click", () => {
            let input = document.createElement("input")
            input.type = "file"
            input.accept = "image/png, image/jpeg, image/webp, image/avif"
            input.onchange = (event) => {
                let file = event.target.files[0]
                if (!file) return
                state.originalFileName = file.name ?? "unnamed.png"
                let reader = new FileReader()
                reader.onload = (e) => {
                    const img = new Image()
                    img.onload = () => {
                        state.uploadedImage = img
                        state.convertedImage = img
                        render()
                    }
                    img.src = e.target.result
                }
                reader.readAsDataURL(file)
            }
            input.click()
        })
        controlPanel.appendChild(uploadButton)
        return controlPanel
    }

    let paletteDropdown = makeSearchableDropdown()
    controlPanel.appendChild(paletteDropdown)

    let resetButton = document.createElement("button")
    resetButton.textContent = config.buttons.clear
    resetButton.addEventListener("click", clear)
    controlPanel.appendChild(resetButton)

    if (state.currentPalette !== "original") {
        let downloadButton = document.createElement("button")
        downloadButton.textContent = config.buttons.download
        downloadButton.addEventListener("click", () => {
            let link = document.createElement("a")
            link.href = state.convertedImage.src
            let filename =
                state.originalFileName.split(".")[0] +
                "-" +
                state.currentPalette.replace(/\s+/g, "-") +
                ".png"
            link.download = filename
            link.click()
        })
        controlPanel.appendChild(downloadButton)
    }

    return controlPanel
}

/**
 * Most of the time the UI is re-rendered from scratch,
 * but for progress updates we just update the text.
 */
function updateProgress() {
    let progressText = state.millancContainer.querySelector("#millanc-progress")
    if (!progressText) {
        progressText = document.createElement("div")
        progressText.id = "millanc-progress"
        state.millancContainer.appendChild(progressText)
    }

    progressText.textContent = `👨‍🎨 ${state.progress}%`
}

function clear() {
    state = freshState()
    render()
}

/**
 * Renders the entire UI from scratch based on the current state.
 */
function render() {
    state.millancContainer.innerHTML = ""
    state.millancContainer.appendChild(makeStyle())
    state.millancContainer.appendChild(makeControlPanel())
    state.millancContainer.appendChild(makeCanvas())
}

/**
 * Creates a new empty state object.
 */
function freshState() {
    return {
        millancContainer: document.getElementById("millanc"),
        uploadedImage: null,
        originalFileName: null,
        convertedImage: null,
        currentPalette: "original",
        searchTerm: "",
        cache: {},
    }
}

function convertImage() {
    // If we already converted this image with this palette, use the cached version.
    // So nice of us.
    if (state.cache[state.currentPalette]) {
        state.convertedImage = state.cache[state.currentPalette]
        render()
        return
    }

    let canvas = state.millancContainer.querySelector("canvas")
    canvas.classList.add("processing")
    let ctx = canvas.getContext("2d")
    ctx.drawImage(state.uploadedImage, 0, 0, canvas.width, canvas.height)
    let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

    const palette = config.palettes[state.currentPalette]
    let rowsPerWorker = Math.floor(canvas.height / config.num_workers)

    let promises = []
    let progress = Array(config.num_workers).fill(0)

    state.progress = 0
    updateProgress()

    for (let i = 0; i < config.num_workers; i++) {
        let startRow = i * rowsPerWorker
        let endRow =
            i === config.num_workers - 1
                ? canvas.height
                : (i + 1) * rowsPerWorker

        let startIdx = startRow * canvas.width * 4
        let endIdx = endRow * canvas.width * 4
        let slice = imageData.data.slice(startIdx, endIdx)

        // --- Create worker from function ---
        let workerBlob = new Blob(["(" + workerFunc.toString() + ")()"], {
            type: "application/javascript",
        })
        let worker = new Worker(URL.createObjectURL(workerBlob))

        promises.push(
            new Promise((resolve) => {
                worker.onmessage = (e) => {
                    if (e.data.type === "progress") {
                        progress[i] = e.data.done / e.data.total
                        let percent =
                            (progress.reduce((a, b) => a + b, 0) /
                                config.num_workers) *
                            100
                        state.progress = Math.trunc(percent)
                        updateProgress()
                    } else if (e.data.type === "done") {
                        resolve({ startIdx, data: e.data.slice })
                        worker.terminate()
                    }
                }

                worker.postMessage({ slice, palette })
            })
        )
    }

    Promise.all(promises).then((results) => {
        for (let res of results) {
            imageData.data.set(res.data, res.startIdx)
        }

        ctx.putImageData(imageData, 0, 0)
        state.progress = null
        let img = new Image()
        img.onload = () => {
            state.convertedImage = img
            state.cache[state.currentPalette] = img
            render()
        }
        img.src = canvas.toDataURL()
    })
}

/**
 * The worker function is converted to a blob and used to create a worker.
 * It receives a slice of the image data and the palette, processes it,
 * and sends back the processed slice.
 */
function workerFunc() {
    self.onmessage = function (e) {
        let { slice, palette } = e.data

        function rgbToOklch(r, g, b) {
            r /= 255
            g /= 255
            b /= 255
            const toLinear = (c) =>
                c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
            r = toLinear(r)
            g = toLinear(g)
            b = toLinear(b)

            let l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
            let m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
            let s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b

            l = Math.cbrt(l)
            m = Math.cbrt(m)
            s = Math.cbrt(s)

            let L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
            let a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
            let b2 = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s

            let C = Math.sqrt(a * a + b2 * b2)
            let h = Math.atan2(b2, a)
            return [L, C, h]
        }

        function oklchToRgb(L, C, h) {
            let a = C * Math.cos(h)
            let b2 = C * Math.sin(h)

            let l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b2, 3)
            let m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b2, 3)
            let s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b2, 3)

            let r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
            let g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
            let b = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s

            const toSrgb = (c) =>
                c <= 0.0031308
                    ? 12.92 * c
                    : 1.055 * Math.pow(c, 1 / 2.4) - 0.055
            return [
                Math.max(0, Math.min(255, toSrgb(r) * 255)),
                Math.max(0, Math.min(255, toSrgb(g) * 255)),
                Math.max(0, Math.min(255, toSrgb(b) * 255)),
            ]
        }

        const pal = palette.map((hex) => {
            let r = parseInt(hex.slice(1, 3), 16),
                g = parseInt(hex.slice(3, 5), 16),
                b = parseInt(hex.slice(5, 7), 16)
            let [L, C, h] = rgbToOklch(r, g, b)
            return {
                L,
                a: C * Math.cos(h),
                b: C * Math.sin(h),
                Lc: L,
                Cc: C,
                hc: h,
            }
        })

        let total = slice.length / 4
        let done = 0
        for (let i = 0; i < slice.length; i += 4) {
            let r = slice[i],
                g = slice[i + 1],
                b = slice[i + 2]
            let [L, C, h] = rgbToOklch(r, g, b)
            let a = C * Math.cos(h),
                bb = C * Math.sin(h)

            let best = pal[0],
                bestDist = Infinity
            for (let p of pal) {
                let dL = L - p.L,
                    da = a - p.a,
                    db = bb - p.b
                let dist = dL * dL + da * da + db * db
                if (dist < bestDist) {
                    bestDist = dist
                    best = p
                }
            }

            let [nr, ng, nb] = oklchToRgb(best.Lc, best.Cc, best.hc)
            slice[i] = nr
            slice[i + 1] = ng
            slice[i + 2] = nb

            done++
            if (done % 100000 === 0) {
                self.postMessage({ type: "progress", done, total })
            }
        }

        self.postMessage({ type: "done", slice })
    }
}

/**
 * So many palettes!
 */
function palettes() {
    return {
        "kanagawa paper": [
            "#1f1f28",
            "#363646",
            "#393836",
            "#435965",
            "#698a9b",
            "#699469",
            "#72a072",
            "#8ea49e",
            "#96ada7",
            "#9e9b93",
            "#c8c093",
            "#dcd7ba",
            "#a292a3",
            "#aca9a4",
            "#b4a7b5",
            "#c4746e",
            "#c4b28a",
            "#cc928e",
            "#d4c196",
            "#d5cd9d",
        ],
        "one dark pro": [
            "#282c34",
            "#56b6c2",
            "#5c6370",
            "#61afef",
            "#7bc6d0",
            "#8fc6f4",
            "#98c379",
            "#abb2bf",
            "#b3d39c",
            "#c678dd",
            "#c8cdd5",
            "#d7a1e7",
            "#e06c75",
            "#e5c07b",
            "#e9969d",
            "#edd4a6",
        ],
        cyberdream: [
            "#16181a",
            "#3c4048",
            "#5ea1ff",
            "#5ef1ff",
            "#5eff6c",
            "#bd5eff",
            "#f1ff5e",
            "#ff6e5e",
            "#ffffff",
        ],
        Adwaita: [
            "#000000",
            "#0ab9dc",
            "#1e78e4",
            "#241f31",
            "#2ec27e",
            "#4fd2fd",
            "#51a1ff",
            "#57e389",
            "#5e5c64",
            "#9841bb",
            "#c01c28",
            "#c061cb",
            "#c0bfbc",
            "#ed333b",
            "#f5c211",
            "#f6f5f4",
            "#f8e45c",
            "#ffffff",
        ],
        "Adwaita Dark": [
            "#0ab9dc",
            "#1e1e1e",
            "#1e78e4",
            "#241f31",
            "#2ec27e",
            "#4fd2fd",
            "#51a1ff",
            "#57e389",
            "#5e5c64",
            "#9841bb",
            "#c01c28",
            "#c061cb",
            "#c0bfbc",
            "#ed333b",
            "#f5c211",
            "#f6f5f4",
            "#f8e45c",
            "#ffffff",
        ],
        Atom: [
            "#000000",
            "#151515",
            "#161719",
            "#444444",
            "#85befd",
            "#87c38a",
            "#94fa36",
            "#96cbfe",
            "#b9b6fc",
            "#c5c8c6",
            "#d0d0d0",
            "#e0e0e0",
            "#f5ffa8",
            "#fd5ff1",
            "#ffd7b1",
        ],
        AtomOneLight: [
            "#000000",
            "#2a2c33",
            "#2f5af3",
            "#3f953a",
            "#950095",
            "#a00095",
            "#bbbbbb",
            "#d2b67c",
            "#de3e35",
            "#ededed",
            "#f9f9f9",
            "#ffffff",
        ],
        "Ayu Mirage": [
            "#191e2a",
            "#1f2430",
            "#33415e",
            "#686868",
            "#6dcbfa",
            "#73d0ff",
            "#90e1c6",
            "#95e6cb",
            "#a6cc70",
            "#bae67e",
            "#c7c7c7",
            "#cbccc6",
            "#cfbafa",
            "#d4bfff",
            "#ed8274",
            "#f28779",
            "#fad07b",
            "#ffcc66",
            "#ffd580",
            "#ffffff",
        ],
        BirdsOfParadise: [
            "#2a1f1d",
            "#563c27",
            "#573d26",
            "#5a86ad",
            "#6ba18a",
            "#74a6ad",
            "#93cfd7",
            "#95d8ba",
            "#9b6c4a",
            "#ac80a6",
            "#b8d3ed",
            "#be2d26",
            "#d0d150",
            "#d19ecb",
            "#e0dbb7",
            "#e0dbbb",
            "#e84627",
            "#e99d2a",
            "#fff9d5",
        ],
        BlulocoDark: [
            "#10b1fe",
            "#25a45c",
            "#272b33",
            "#282c34",
            "#3476ff",
            "#3fc56b",
            "#41444d",
            "#4483aa",
            "#5fb9bc",
            "#7a82da",
            "#8f9aae",
            "#b9c0ca",
            "#b9c0cb",
            "#cdd4e0",
            "#f9c859",
            "#fc2f52",
            "#ff6480",
            "#ff78f8",
            "#ff936a",
            "#ffcc00",
            "#ffffff",
        ],
        BlulocoLight: [
            "#0099e1",
            "#23974a",
            "#275fe4",
            "#27618d",
            "#373a41",
            "#3cbc66",
            "#676a77",
            "#6d93bb",
            "#823ff1",
            "#babbc2",
            "#c5a332",
            "#ce33c0",
            "#d3d3d3",
            "#d52753",
            "#daf0ff",
            "#df631c",
            "#f32759",
            "#f9f9f9",
            "#ff6480",
            "#ffffff",
        ],
        Borland: [
            "#0000a4",
            "#4f4f4f",
            "#7c7c7c",
            "#96cbfe",
            "#a4a4a4",
            "#a8ff60",
            "#b5dcff",
            "#c6c5fe",
            "#ceffac",
            "#dfdffe",
            "#eeeeee",
            "#ff6c60",
            "#ff73fd",
            "#ff9cfe",
            "#ffa560",
            "#ffb6b0",
            "#ffff4e",
            "#ffffb6",
            "#ffffcc",
            "#ffffff",
        ],
        Brogrammer: [
            "#0f7ddb",
            "#101010",
            "#1081d6",
            "#131313",
            "#1dd361",
            "#1f1f1f",
            "#2a84d2",
            "#2dc55e",
            "#4e5ab7",
            "#5350b9",
            "#b9b9b9",
            "#d6dbe5",
            "#de352e",
            "#ecba0f",
            "#f3bd09",
            "#f81118",
            "#ffffff",
        ],
        Cobalt2: [
            "#000000",
            "#00bbbb",
            "#132738",
            "#1460d2",
            "#18354f",
            "#38de21",
            "#3bd01d",
            "#555555",
            "#5555ff",
            "#6ae3fa",
            "#b5b5b5",
            "#bbbbbb",
            "#edc809",
            "#f0cc09",
            "#f40e17",
            "#fefff2",
            "#ff0000",
            "#ff005d",
            "#ff55ff",
            "#ffe50a",
            "#ffffff",
        ],
        Dracula: [
            "#000000",
            "#1e1f29",
            "#44475a",
            "#50fa7b",
            "#555555",
            "#8be9fd",
            "#bbbbbb",
            "#bd93f9",
            "#e6e6e6",
            "#f1fa8c",
            "#ff5555",
            "#ff79c6",
            "#ffffff",
        ],
        "Everforest Dark - Hard": [
            "#1e2326",
            "#35a77c",
            "#3a94c5",
            "#4c3743",
            "#7a8478",
            "#7fbbb3",
            "#83c092",
            "#8da101",
            "#a6b0a0",
            "#a7c080",
            "#d3c6aa",
            "#d699b6",
            "#dbbc7f",
            "#df69ba",
            "#dfa000",
            "#e67e80",
            "#e69875",
            "#f2efdf",
            "#f85552",
            "#fffbef",
        ],
        "Ghostty Default StyleDark": [
            "#1d1f21",
            "#292c33",
            "#363a43",
            "#666666",
            "#83a5d6",
            "#83beb1",
            "#88a1bb",
            "#95bdb7",
            "#ad95b8",
            "#b7bd73",
            "#bc99d4",
            "#bcc95f",
            "#bf6b69",
            "#c55757",
            "#c5c8c6",
            "#e1c65e",
            "#e9c880",
            "#eaeaea",
            "#ffffff",
        ],
        "GitHub Dark": [
            "#000000",
            "#101216",
            "#2b7489",
            "#3b5070",
            "#4d4d4d",
            "#56d364",
            "#6ca4f8",
            "#8b949e",
            "#c9d1d9",
            "#db61a2",
            "#e3b341",
            "#f78166",
            "#ffffff",
        ],
        "GitHub-Dark-Colorblind": [
            "#0d1117",
            "#39c5cf",
            "#484f58",
            "#56d4dd",
            "#58a6ff",
            "#6e7681",
            "#79c0ff",
            "#b1bac4",
            "#bc8cff",
            "#c9d1d9",
            "#d29922",
            "#d2a8ff",
            "#e3b341",
            "#ec8e2c",
            "#fdac54",
            "#ffffff",
        ],
        "GitHub-Dark-Default": [
            "#0d1117",
            "#2f81f7",
            "#39c5cf",
            "#3fb950",
            "#484f58",
            "#56d364",
            "#56d4dd",
            "#58a6ff",
            "#6e7681",
            "#79c0ff",
            "#b1bac4",
            "#bc8cff",
            "#d29922",
            "#d2a8ff",
            "#e3b341",
            "#e6edf3",
            "#ff7b72",
            "#ffa198",
            "#ffffff",
        ],
        "GitHub-Dark-Dimmed": [
            "#22272e",
            "#39c5cf",
            "#539bf5",
            "#545d68",
            "#56d4dd",
            "#57ab5a",
            "#636e7b",
            "#6bc46d",
            "#6cb6ff",
            "#909dab",
            "#adbac7",
            "#b083f0",
            "#c69026",
            "#cdd9e5",
            "#daaa3f",
            "#dcbdfb",
            "#f47067",
            "#ff938a",
        ],
        "GitHub-Dark-High-Contrast": [
            "#0a0c10",
            "#26cd4d",
            "#39c5cf",
            "#4ae168",
            "#56d4dd",
            "#71b7ff",
            "#7a828e",
            "#91cbff",
            "#9ea7b3",
            "#cb9eff",
            "#d9dee3",
            "#dbb7ff",
            "#f0b72f",
            "#f0f3f6",
            "#f7c843",
            "#ff9492",
            "#ffb1af",
            "#ffffff",
        ],
        "GitHub-Light-Colorblind": [
            "#0550ae",
            "#0969da",
            "#1b7c83",
            "#218bff",
            "#24292f",
            "#3192aa",
            "#4d2d00",
            "#57606a",
            "#633c01",
            "#6e7781",
            "#8250df",
            "#8a4600",
            "#8c959f",
            "#a475f9",
            "#b35900",
            "#ffffff",
        ],
        "GitHub-Light-Default": [
            "#0969da",
            "#116329",
            "#1a7f37",
            "#1b7c83",
            "#1f2328",
            "#218bff",
            "#24292f",
            "#3192aa",
            "#4d2d00",
            "#57606a",
            "#633c01",
            "#6e7781",
            "#8250df",
            "#8c959f",
            "#a40e26",
            "#a475f9",
            "#cf222e",
            "#ffffff",
        ],
        "GitHub-Light-High-Contrast": [
            "#024c1a",
            "#0349b4",
            "#055d20",
            "#0e1116",
            "#1168e3",
            "#1b7c83",
            "#3192aa",
            "#3f2200",
            "#4b535d",
            "#4e2c00",
            "#622cbc",
            "#66707b",
            "#844ae7",
            "#86061d",
            "#88929d",
            "#a0111f",
            "#ffffff",
        ],
        "GitLab-Dark": [
            "#000000",
            "#28262b",
            "#32c5d2",
            "#498dd1",
            "#52b87a",
            "#5edee3",
            "#666666",
            "#7fb6ed",
            "#91d4a8",
            "#ad95e9",
            "#d99530",
            "#e9be74",
            "#f57f6c",
            "#f88aaf",
            "#fcacc5",
            "#fcb5aa",
            "#ffffff",
        ],
        "GitLab-Dark-Grey": [
            "#000000",
            "#222222",
            "#32c5d2",
            "#498dd1",
            "#52b87a",
            "#5edee3",
            "#666666",
            "#7fb6ed",
            "#91d4a8",
            "#ad95e9",
            "#d99530",
            "#e9be74",
            "#f57f6c",
            "#f88aaf",
            "#fcacc5",
            "#fcb5aa",
            "#ffffff",
        ],
        "GitLab-Light": [
            "#006cd8",
            "#00798a",
            "#0a7f3d",
            "#303030",
            "#583cac",
            "#a31700",
            "#ad95e9",
            "#af551d",
            "#fafaff",
        ],
        Github: [
            "#003e8a",
            "#07962a",
            "#1cfafe",
            "#2e6cba",
            "#3e3e3e",
            "#3f3f3f",
            "#535353",
            "#666666",
            "#87d5a2",
            "#89d1ec",
            "#970b16",
            "#a9c1e2",
            "#de0000",
            "#e94691",
            "#f1d007",
            "#f4f4f4",
            "#f8eec7",
            "#ffa29f",
            "#ffffff",
        ],
        GruvboxDark: [
            "#282828",
            "#458588",
            "#665c54",
            "#689d6a",
            "#83a598",
            "#8ec07c",
            "#928374",
            "#98971a",
            "#a89984",
            "#b16286",
            "#b8bb26",
            "#cc241d",
            "#d3869b",
            "#d79921",
            "#ebdbb2",
            "#fabd2f",
            "#fb4934",
        ],
        GruvboxDarkHard: [
            "#1d2021",
            "#458588",
            "#665c54",
            "#689d6a",
            "#83a598",
            "#8ec07c",
            "#928374",
            "#98971a",
            "#a89984",
            "#b16286",
            "#b8bb26",
            "#cc241d",
            "#d3869b",
            "#d79921",
            "#ebdbb2",
            "#fabd2f",
            "#fb4934",
        ],
        GruvboxLight: [
            "#076678",
            "#282828",
            "#3c3836",
            "#427b58",
            "#458588",
            "#665c54",
            "#689d69",
            "#79740e",
            "#7c6f64",
            "#8f3f71",
            "#98971a",
            "#9d0006",
            "#9d8374",
            "#b16186",
            "#b57614",
            "#cc241d",
            "#d5c4a1",
            "#d79921",
            "#fbf1c7",
        ],
        GruvboxLightHard: [
            "#076678",
            "#282828",
            "#3c3836",
            "#427b58",
            "#458588",
            "#665c54",
            "#689d69",
            "#79740e",
            "#7c6f64",
            "#8f3f71",
            "#98971a",
            "#9d0006",
            "#9d8374",
            "#b16186",
            "#b57614",
            "#cc241d",
            "#d5c4a1",
            "#d79921",
            "#f8f4d6",
        ],
        Hopscotch: [
            "#1290bf",
            "#149b93",
            "#322931",
            "#433b42",
            "#5c545b",
            "#797379",
            "#8fc13e",
            "#989498",
            "#b33508",
            "#b9b5b8",
            "#c85e7c",
            "#d5d3d5",
            "#dd464c",
            "#fd8b19",
            "#fdcc59",
            "#ffffff",
        ],
        "Hopscotch.256": [
            "#1290bf",
            "#149b93",
            "#322931",
            "#5c545b",
            "#797379",
            "#8fc13e",
            "#b9b5b8",
            "#c85e7c",
            "#dd464c",
            "#fdcc59",
            "#ffffff",
        ],
        Jellybeans: [
            "#00988e",
            "#121212",
            "#1ab2a8",
            "#474e91",
            "#929292",
            "#94b979",
            "#97bedc",
            "#b1d8f6",
            "#bdbdbd",
            "#bddeab",
            "#dedede",
            "#e1c0fa",
            "#e27373",
            "#f4f4f4",
            "#fbdaff",
            "#ffa1a1",
            "#ffa560",
            "#ffba7b",
            "#ffdca0",
            "#ffffff",
        ],
        "Kanagawa Dragon": [
            "#0d0c0c",
            "#181616",
            "#1d202f",
            "#223249",
            "#7aa89f",
            "#7fb4ca",
            "#87a987",
            "#8a9a7b",
            "#8ba4b0",
            "#8ea4a2",
            "#938aa9",
            "#a292a3",
            "#a6a69c",
            "#c4746e",
            "#c4b28a",
            "#c5c9c5",
            "#c8c093",
            "#e46876",
            "#e6c384",
        ],
        "Kanagawa Wave": [
            "#090618",
            "#1d202f",
            "#1f1f28",
            "#2d4f67",
            "#6a9589",
            "#727169",
            "#76946a",
            "#7aa89f",
            "#7e9cd8",
            "#7fb4ca",
            "#938aa9",
            "#957fb8",
            "#98bb6c",
            "#c0a36e",
            "#c34043",
            "#c8c093",
            "#dcd7ba",
            "#e6c384",
            "#e82424",
        ],
        Material: [
            "#0e717c",
            "#134eb2",
            "#16afca",
            "#212121",
            "#232322",
            "#26bbd1",
            "#2e2e2d",
            "#424242",
            "#457b24",
            "#4e4e4e",
            "#54a4f3",
            "#560088",
            "#7aba3a",
            "#aa4dbc",
            "#b7141f",
            "#c2c2c2",
            "#d9d9d9",
            "#e83b3f",
            "#eaeaea",
            "#efefef",
            "#f6981e",
            "#ffea2e",
        ],
        MaterialDark: [
            "#0e717c",
            "#134eb2",
            "#16afca",
            "#212121",
            "#232322",
            "#26bbd1",
            "#3d3d3d",
            "#424242",
            "#457b24",
            "#54a4f3",
            "#560088",
            "#7aba3a",
            "#aa4dbc",
            "#b7141f",
            "#d9d9d9",
            "#dfdfdf",
            "#e5e5e5",
            "#e83b3f",
            "#efefef",
            "#f6981e",
            "#ffea2e",
        ],
        MaterialDarker: [
            "#000000",
            "#212121",
            "#545454",
            "#82aaff",
            "#89ddff",
            "#c3e88d",
            "#c792ea",
            "#eeffff",
            "#ff5370",
            "#ffcb6b",
            "#ffffff",
        ],
        MaterialOcean: [
            "#0f111a",
            "#1f2233",
            "#546e7a",
            "#82aaff",
            "#89ddff",
            "#8f93a2",
            "#c3e88d",
            "#c792ea",
            "#ff5370",
            "#ffcb6b",
            "#ffcc00",
            "#ffffff",
        ],
        Mellifluous: [
            "#1a1a1a",
            "#2d2d2d",
            "#5a6599",
            "#5b5b5b",
            "#74a39e",
            "#828040",
            "#9c6995",
            "#a6794c",
            "#a8a1be",
            "#b39fb0",
            "#b3b393",
            "#bfad9e",
            "#c0af8c",
            "#c95954",
            "#cbaa89",
            "#d29393",
            "#dadada",
            "#ffffff",
        ],
        "Monokai Classic": [
            "#272822",
            "#57584f",
            "#66d9ef",
            "#6e7066",
            "#a6e22e",
            "#ae81ff",
            "#c0c1b5",
            "#e6db74",
            "#f92672",
            "#fd971f",
            "#fdfff1",
        ],
        "Monokai Pro": [
            "#2d2a2e",
            "#5b595c",
            "#727072",
            "#78dce8",
            "#a9dc76",
            "#ab9df2",
            "#c1c0c0",
            "#fc9867",
            "#fcfcfa",
            "#ff6188",
            "#ffd866",
        ],
        NvimDark: [
            "#07080d",
            "#14161b",
            "#4f5258",
            "#8cf8f7",
            "#9b9ea4",
            "#a6dbff",
            "#b3f6c0",
            "#e0e2ea",
            "#eef1f8",
            "#fce094",
            "#ffc0b9",
            "#ffcaff",
        ],
        NvimLight: [
            "#004c73",
            "#005523",
            "#007373",
            "#07080d",
            "#14161b",
            "#470045",
            "#4f5258",
            "#590008",
            "#6b5300",
            "#9b9ea4",
            "#e0e2ea",
            "#eef1f8",
        ],
        Obsidian: [
            "#000000",
            "#00bb00",
            "#00bbbb",
            "#283033",
            "#3a9bdb",
            "#3e4c4f",
            "#555555",
            "#55ffff",
            "#93c863",
            "#a1d7ff",
            "#a60001",
            "#bb00bb",
            "#bbbbbb",
            "#c0cad0",
            "#cdcdcd",
            "#dfe1e2",
            "#fecd22",
            "#fef874",
            "#ff0003",
            "#ff55ff",
            "#ffffff",
        ],
        "Oceanic-Next": [
            "#1b2b34",
            "#1e2b33",
            "#515b65",
            "#68737d",
            "#7198c8",
            "#74b1b2",
            "#a2c699",
            "#bd96c2",
            "#c1c5cd",
            "#db686b",
            "#f2ca73",
            "#ffffff",
        ],
        OceanicMaterial: [
            "#000000",
            "#16afca",
            "#1c262b",
            "#1e80f0",
            "#40a33f",
            "#42c7da",
            "#54a4f3",
            "#6dc2b8",
            "#70be71",
            "#777777",
            "#8800a0",
            "#a4a4a4",
            "#aa4dbc",
            "#b3b8c3",
            "#c2c8d7",
            "#dc5c60",
            "#ee2b2a",
            "#ffea2e",
            "#fff163",
            "#ffffff",
        ],
        Oxocarbon: [
            "#000000",
            "#161616",
            "#33b1ff",
            "#393939",
            "#3ddbd9",
            "#42be65",
            "#585858",
            "#be95ff",
            "#ee5396",
            "#f2f4f8",
            "#ff7eb6",
            "#ffffff",
        ],
        PaleNightHC: [
            "#000000",
            "#323232",
            "#3e4251",
            "#666666",
            "#717cb4",
            "#80cbc4",
            "#82aaff",
            "#89ddff",
            "#999999",
            "#b4ccff",
            "#b8eaff",
            "#c3e88d",
            "#c792ea",
            "#cccccc",
            "#dbf1ba",
            "#ddbdf2",
            "#f07178",
            "#f6a9ae",
            "#ffcb6b",
            "#ffdfa6",
            "#ffffff",
        ],
        "Popping and Locking": [
            "#181921",
            "#1d2021",
            "#458588",
            "#689d6a",
            "#7ec16e",
            "#928374",
            "#98971a",
            "#99c6ca",
            "#a89984",
            "#b16286",
            "#b8bb26",
            "#c7c7c7",
            "#cc241d",
            "#d3869b",
            "#d79921",
            "#ebdbb2",
            "#f42c3e",
            "#fabd2f",
            "#ffffff",
        ],
        "SpaceGray Eighties": [
            "#15171c",
            "#222222",
            "#272e35",
            "#4d84d1",
            "#5486c0",
            "#555555",
            "#57c2c1",
            "#81a764",
            "#83e9e4",
            "#93d493",
            "#bbbbbb",
            "#bdbaae",
            "#bf83c1",
            "#ec5f67",
            "#efece7",
            "#fec254",
            "#ff55ff",
            "#ff6973",
            "#ffd256",
            "#ffffff",
        ],
        Tomorrow: [
            "#000000",
            "#3e999f",
            "#4271ae",
            "#4d4d4c",
            "#718c00",
            "#8959a8",
            "#c82829",
            "#d6d6d6",
            "#eab700",
            "#ffffff",
        ],
        "Tomorrow Night": [
            "#000000",
            "#1d1f21",
            "#373b41",
            "#81a2be",
            "#8abeb7",
            "#b294bb",
            "#b5bd68",
            "#c5c8c6",
            "#cc6666",
            "#f0c674",
            "#ffffff",
        ],
        "Tomorrow Night Eighties": [
            "#000000",
            "#2d2d2d",
            "#515151",
            "#6699cc",
            "#66cccc",
            "#99cc99",
            "#cc99cc",
            "#cccccc",
            "#f2777a",
            "#ffcc66",
            "#ffffff",
        ],
        Zenburn: [
            "#000000",
            "#21322f",
            "#3f3f3f",
            "#4d4d4d",
            "#506070",
            "#60b48a",
            "#705050",
            "#709080",
            "#73635a",
            "#8cd0d3",
            "#93e0e3",
            "#94bff3",
            "#c2d87a",
            "#c3bf9f",
            "#dc8cc3",
            "#dca3a3",
            "#dcdccc",
            "#e0cf9f",
            "#ec93d3",
            "#f0dfaf",
            "#ffffff",
        ],
        ayu: [
            "#000000",
            "#0f1419",
            "#253340",
            "#323232",
            "#36a3d9",
            "#68d5ff",
            "#95e6cb",
            "#b8cc52",
            "#c7fffd",
            "#e6e1cf",
            "#e7c547",
            "#eafe84",
            "#f07178",
            "#f29718",
            "#ff3333",
            "#ff6565",
            "#ffa3aa",
            "#fff779",
            "#ffffff",
        ],
        ayu_light: [
            "#000000",
            "#323232",
            "#41a6d9",
            "#4dbf99",
            "#5c6773",
            "#73d8ff",
            "#7ff1cb",
            "#86b300",
            "#b8e532",
            "#f07178",
            "#f0eee4",
            "#f29718",
            "#fafafa",
            "#ff3333",
            "#ff6565",
            "#ff6a00",
            "#ffa3aa",
            "#ffc94a",
            "#ffffff",
        ],
        carbonfox: [
            "#08bdba",
            "#161616",
            "#25be6a",
            "#282828",
            "#2a2a2a",
            "#2dc7c4",
            "#33b1ff",
            "#3ddbd9",
            "#46c880",
            "#484848",
            "#52bdff",
            "#78a9ff",
            "#8cb6ff",
            "#be95ff",
            "#c8a5ff",
            "#dfdfe0",
            "#e4e4e5",
            "#ee5396",
            "#f16da6",
            "#f2f4f8",
        ],
        "catppuccin-frappe": [
            "#303446",
            "#51576d",
            "#5abfb5",
            "#626880",
            "#7b9ef0",
            "#81c8be",
            "#8caaee",
            "#8ec772",
            "#a5adce",
            "#a6d189",
            "#b5bfe2",
            "#c6d0f5",
            "#d9ba73",
            "#e5c890",
            "#e67172",
            "#e78284",
            "#f2a4db",
            "#f2d5cf",
            "#f4b8e4",
        ],
        "catppuccin-latte": [
            "#179299",
            "#1e66f5",
            "#2d9fa8",
            "#40a02b",
            "#456eff",
            "#49af3d",
            "#4c4f69",
            "#5c5f77",
            "#6c6f85",
            "#acb0be",
            "#bcc0cc",
            "#d20f39",
            "#dc8a78",
            "#de293e",
            "#df8e1d",
            "#ea76cb",
            "#eea02d",
            "#eff1f5",
            "#fe85d8",
        ],
        "catppuccin-macchiato": [
            "#24273a",
            "#494d64",
            "#5b6078",
            "#63cbc0",
            "#78a1f6",
            "#8aadf4",
            "#8bd5ca",
            "#8ccf7f",
            "#a5adcb",
            "#a6da95",
            "#b8c0e0",
            "#cad3f5",
            "#e1c682",
            "#ec7486",
            "#ed8796",
            "#eed49f",
            "#f2a9dd",
            "#f4dbd6",
            "#f5bde6",
        ],
        "catppuccin-mocha": [
            "#1e1e2e",
            "#45475a",
            "#585b70",
            "#6bd7ca",
            "#74a8fc",
            "#89b4fa",
            "#89d88b",
            "#94e2d5",
            "#a6adc8",
            "#a6e3a1",
            "#bac2de",
            "#cdd6f4",
            "#ebd391",
            "#f2aede",
            "#f37799",
            "#f38ba8",
            "#f5c2e7",
            "#f5e0dc",
            "#f9e2af",
        ],
        citruszest: [
            "#00bfff",
            "#00cc7a",
            "#00fff2",
            "#121212",
            "#1affa3",
            "#33cfff",
            "#404040",
            "#48d1cc",
            "#666666",
            "#808080",
            "#bfbfbf",
            "#f4f4f4",
            "#f9f9f9",
            "#ff1a75",
            "#ff5454",
            "#ff8c00",
            "#ff90fe",
            "#ffb2fe",
            "#ffd400",
            "#ffff00",
        ],
        cyberpunk: [
            "#000000",
            "#00bfff",
            "#00fbac",
            "#1bccfd",
            "#21f6bc",
            "#332a57",
            "#86cbfe",
            "#99d6fc",
            "#c1deff",
            "#df95ff",
            "#e5e5e5",
            "#e6aefe",
            "#ff7092",
            "#ff8aa4",
            "#fff787",
            "#fffa6a",
            "#ffffff",
        ],
        dawnfox: [
            "#286983",
            "#2d81a3",
            "#56949f",
            "#575279",
            "#5ca7b4",
            "#5f5695",
            "#618774",
            "#629f81",
            "#907aa9",
            "#9a80b9",
            "#b4637a",
            "#c26d85",
            "#d0d8d8",
            "#d7827e",
            "#e5e9f0",
            "#e6ebf3",
            "#ea9d34",
            "#eea846",
            "#faf4ed",
        ],
        dayfox: [
            "#2848a9",
            "#287980",
            "#352c24",
            "#396847",
            "#3d2b5a",
            "#4863b6",
            "#488d93",
            "#534c45",
            "#577f63",
            "#6e33ce",
            "#8452d5",
            "#a5222f",
            "#ac5402",
            "#b3434e",
            "#b86e28",
            "#e7d2be",
            "#f2e9e1",
            "#f4ece6",
            "#f6f2ee",
        ],
        duckbones: [
            "#00a3cb",
            "#00b4e0",
            "#0e101a",
            "#2b2f46",
            "#37382d",
            "#58db9e",
            "#5dcd97",
            "#795ccc",
            "#b3a1e6",
            "#b3b692",
            "#e03600",
            "#e39500",
            "#ebefc0",
            "#edf2c2",
            "#f6a100",
            "#ff4821",
        ],
        duskfox: [
            "#232136",
            "#393552",
            "#433c59",
            "#47407d",
            "#569fba",
            "#65b1cd",
            "#9ccfd8",
            "#a3be8c",
            "#a6dae3",
            "#b1d196",
            "#c4a7e7",
            "#ccb1ed",
            "#e0def4",
            "#e2e0f7",
            "#ea9a97",
            "#eb6f92",
            "#f083a2",
            "#f6c177",
            "#f9cb8c",
        ],
        "gruvbox-material": [
            "#000000",
            "#141617",
            "#1d2021",
            "#2b2c3f",
            "#2c86ff",
            "#6da3ec",
            "#7cfb70",
            "#92a5df",
            "#c1d041",
            "#d3573b",
            "#d4be98",
            "#ea6926",
            "#eecf75",
            "#fd9bc1",
            "#fe9d6e",
            "#ffffff",
        ],
        kanagawabones: [
            "#1f1f28",
            "#3c3c51",
            "#49473e",
            "#7bc2df",
            "#7eb3c9",
            "#957fb8",
            "#98bc6d",
            "#9ec967",
            "#a8a48d",
            "#a98fd2",
            "#ddd8bb",
            "#e46a78",
            "#e5c283",
            "#e6e0c2",
            "#ec818c",
            "#f1c982",
        ],
        neobones_dark: [
            "#0f191f",
            "#263945",
            "#3a3e3d",
            "#65b8c1",
            "#66a5ad",
            "#8190d4",
            "#90ff6b",
            "#92a0e2",
            "#98a39e",
            "#a0ff85",
            "#b279a7",
            "#b77e64",
            "#c6d5cf",
            "#ceddd7",
            "#cf86c1",
            "#d68c67",
            "#de6e7c",
            "#e8838f",
        ],
        neobones_light: [
            "#1d5573",
            "#202e18",
            "#286486",
            "#2b747c",
            "#3b8992",
            "#3f5a22",
            "#415934",
            "#567a30",
            "#7b3b70",
            "#803d1c",
            "#88507d",
            "#94253e",
            "#944927",
            "#a8334c",
            "#ade48c",
            "#b3c6b6",
            "#e5ede6",
        ],
        nightfox: [
            "#192330",
            "#2b3b51",
            "#393b44",
            "#575860",
            "#63cdcf",
            "#719cd6",
            "#7ad5d6",
            "#81b29a",
            "#86abdc",
            "#8ebaa4",
            "#9d79d6",
            "#baa1e2",
            "#c94f6d",
            "#cdcecf",
            "#d16983",
            "#dbc074",
            "#dfdfe0",
            "#e0c989",
            "#e4e4e5",
        ],
        nord: [
            "#282828",
            "#2e3440",
            "#3b4252",
            "#4c566a",
            "#81a1c1",
            "#88c0d0",
            "#8fbcbb",
            "#a3be8c",
            "#b48ead",
            "#bf616a",
            "#d8dee9",
            "#e5e9f0",
            "#ebcb8b",
            "#eceff4",
        ],
        "nord-light": [
            "#3b4252",
            "#414858",
            "#4c556a",
            "#4c566a",
            "#81a1c1",
            "#88c0d0",
            "#8fbcbb",
            "#a3be8c",
            "#b48ead",
            "#bf616a",
            "#d8dee9",
            "#e5e9f0",
            "#ebcb8b",
            "#eceff4",
        ],
        "nord-wave": [
            "#212121",
            "#3b4252",
            "#4c566a",
            "#81a1c1",
            "#88c0d0",
            "#8fbcbb",
            "#a3be8c",
            "#b48ead",
            "#bf616a",
            "#d8dee9",
            "#e5e9f0",
            "#ebcb8b",
            "#eceff4",
        ],
        nordfox: [
            "#2e3440",
            "#3b4252",
            "#3e4a5b",
            "#465780",
            "#81a1c1",
            "#88c0d0",
            "#8cafd2",
            "#93ccdc",
            "#a3be8c",
            "#b1d196",
            "#b48ead",
            "#bf616a",
            "#c895bf",
            "#c9826b",
            "#cdcecf",
            "#d06f79",
            "#e5e9f0",
            "#e7ecf4",
            "#ebcb8b",
            "#f0d399",
        ],
        "rose-pine": [
            "#191724",
            "#26233a",
            "#31748f",
            "#403d52",
            "#6e6a86",
            "#9ccfd8",
            "#c4a7e7",
            "#e0def4",
            "#eb6f92",
            "#ebbcba",
            "#f6c177",
        ],
        "rose-pine-dawn": [
            "#286983",
            "#56949f",
            "#575279",
            "#907aa9",
            "#9893a5",
            "#b4637a",
            "#d7827e",
            "#dfdad9",
            "#ea9d34",
            "#f2e9e1",
            "#faf4ed",
        ],
        "rose-pine-moon": [
            "#232136",
            "#393552",
            "#3e8fb0",
            "#44415a",
            "#6e6a86",
            "#9ccfd8",
            "#c4a7e7",
            "#e0def4",
            "#ea9a97",
            "#eb6f92",
            "#f6c177",
        ],
        seoulbones_dark: [
            "#4b4b4b",
            "#6bcacb",
            "#6c6465",
            "#6fbdbe",
            "#777777",
            "#8fcd92",
            "#97bdde",
            "#98bd99",
            "#a2c8e9",
            "#a5a6c5",
            "#a8a8a8",
            "#b2b3da",
            "#dddddd",
            "#e2e2e2",
            "#e388a3",
            "#eb99b1",
            "#ffdf9b",
            "#ffe5b3",
        ],
        seoulbones_light: [
            "#006f70",
            "#006f89",
            "#0084a3",
            "#008586",
            "#487249",
            "#555555",
            "#628562",
            "#777777",
            "#7f4c7e",
            "#896788",
            "#a76b48",
            "#be3c6d",
            "#bfbabb",
            "#c48562",
            "#cccccc",
            "#dc5284",
            "#e2e2e2",
        ],
        synthwave: [
            "#000000",
            "#12c3e2",
            "#19cde6",
            "#1ebb2b",
            "#2186ec",
            "#25c141",
            "#2f9ded",
            "#dad9c7",
            "#f6188f",
            "#f841a0",
            "#f85a21",
            "#f97137",
            "#fdf454",
            "#fdf834",
            "#ffffff",
        ],
        terafox: [
            "#152528",
            "#293e40",
            "#2f3239",
            "#4e5157",
            "#5a93aa",
            "#73a3b7",
            "#7aa4a1",
            "#8eb2af",
            "#a1cdd8",
            "#ad5c7c",
            "#afd4de",
            "#b97490",
            "#e6eaea",
            "#e85c51",
            "#eb746b",
            "#ebebeb",
            "#eeeeee",
            "#fda47f",
            "#fdb292",
        ],
        tokyonight: [
            "#15161e",
            "#1a1b26",
            "#33467c",
            "#414868",
            "#7aa2f7",
            "#7dcfff",
            "#9ece6a",
            "#a9b1d6",
            "#bb9af7",
            "#c0caf5",
            "#e0af68",
            "#f7768e",
        ],
        "tokyonight-day": [
            "#007197",
            "#2e7de9",
            "#3760bf",
            "#587539",
            "#6172b0",
            "#8c6c3e",
            "#9854f1",
            "#99a7df",
            "#a1a6c5",
            "#e1e2e7",
            "#e9e9ed",
            "#f52a65",
        ],
        "tokyonight-storm": [
            "#1d202f",
            "#24283b",
            "#364a82",
            "#414868",
            "#7aa2f7",
            "#7dcfff",
            "#9ece6a",
            "#a9b1d6",
            "#bb9af7",
            "#c0caf5",
            "#e0af68",
            "#f7768e",
        ],
        tokyonight_moon: [
            "#1b1d2b",
            "#222436",
            "#2d3f76",
            "#444a73",
            "#828bb8",
            "#82aaff",
            "#86e1fc",
            "#c099ff",
            "#c3e88d",
            "#c8d3f5",
            "#ff757f",
            "#ffc777",
        ],
        tokyonight_night: [
            "#15161e",
            "#1a1b26",
            "#283457",
            "#414868",
            "#7aa2f7",
            "#7dcfff",
            "#9ece6a",
            "#a9b1d6",
            "#bb9af7",
            "#c0caf5",
            "#e0af68",
            "#f7768e",
        ],
        vimbones: [
            "#1d5573",
            "#286486",
            "#2b747c",
            "#353535",
            "#3b8992",
            "#3f5a22",
            "#4f6c31",
            "#5c5c5c",
            "#7b3b70",
            "#803d1c",
            "#88507d",
            "#94253e",
            "#944927",
            "#a8334c",
            "#c6c6a3",
            "#d7d7d7",
            "#f0f0ca",
        ],
        xcodedark: [
            "#292a30",
            "#414453",
            "#4eb0cc",
            "#6bdfff",
            "#78c2b3",
            "#7f8c98",
            "#acf2e4",
            "#b281eb",
            "#d9c97c",
            "#dabaff",
            "#dfdfe0",
            "#ff7ab2",
            "#ff8170",
            "#ffa14f",
        ],
        zenbones: [
            "#1d5573",
            "#286486",
            "#2b747c",
            "#2c363c",
            "#3b8992",
            "#3f5a22",
            "#4f5e68",
            "#4f6c31",
            "#7b3b70",
            "#803d1c",
            "#88507d",
            "#94253e",
            "#944927",
            "#a8334c",
            "#cbd9e3",
            "#cfc1ba",
            "#f0edec",
        ],
        zenbones_dark: [
            "#1c1917",
            "#3d4042",
            "#403833",
            "#6099c0",
            "#61abda",
            "#65b8c1",
            "#66a5ad",
            "#819b69",
            "#888f94",
            "#8bae68",
            "#b279a7",
            "#b4bdc3",
            "#b77e64",
            "#c4cacf",
            "#cf86c1",
            "#d68c67",
            "#de6e7c",
            "#e8838f",
        ],
        zenbones_light: [
            "#1d5573",
            "#286486",
            "#2b747c",
            "#2c363c",
            "#3b8992",
            "#3f5a22",
            "#4f5e68",
            "#4f6c31",
            "#7b3b70",
            "#803d1c",
            "#88507d",
            "#94253e",
            "#944927",
            "#a8334c",
            "#cbd9e3",
            "#cfc1ba",
            "#f0edec",
        ],
        zenburned: [
            "#404040",
            "#6099c0",
            "#61abda",
            "#625a5b",
            "#65b8c1",
            "#66a5ad",
            "#746956",
            "#819b69",
            "#8bae68",
            "#b279a7",
            "#b77e64",
            "#c0ab86",
            "#cf86c1",
            "#d68c67",
            "#e3716e",
            "#ec8685",
            "#f0e4cf",
            "#f3eadb",
        ],
        zenwritten_dark: [
            "#191919",
            "#3d3839",
            "#404040",
            "#6099c0",
            "#61abda",
            "#65b8c1",
            "#66a5ad",
            "#819b69",
            "#8bae68",
            "#8e8e8e",
            "#b279a7",
            "#b77e64",
            "#bbbbbb",
            "#c9c9c9",
            "#cf86c1",
            "#d68c67",
            "#de6e7c",
            "#e8838f",
        ],
        zenwritten_light: [
            "#1d5573",
            "#286486",
            "#2b747c",
            "#353535",
            "#3b8992",
            "#3f5a22",
            "#4f6c31",
            "#5c5c5c",
            "#7b3b70",
            "#803d1c",
            "#88507d",
            "#94253e",
            "#944927",
            "#a8334c",
            "#c6c3c3",
            "#d7d7d7",
            "#eeeeee",
        ],
        "vscode-dark": [
            "#1F1F1F",
            "#569CD6",
            "#56B6C2",
            "#6A9955",
            "#808080",
            "#C586C0",
            "#D4D4D4",
            "#DCDCAA",
            "#F44747",
        ],
        "vscode-light": [
            "#000000",
            "#007acc",
            "#008000",
            "#56b6c2",
            "#795e25",
            "#808080",
            "#D4D4D4",
            "#af00db",
            "#c72e0f",
            "#ffffff",
        ],
        moonfly: [
            "#080808",
            "#323437",
            "#36c692",
            "#74b2ff",
            "#79dac8",
            "#80a0ff",
            "#85dc85",
            "#8cc85f",
            "#8e8e8e",
            "#949494",
            "#ae81ff",
            "#b2ceee",
            "#bdbdbd",
            "#c6c684",
            "#c6c6c6",
            "#cf87e8",
            "#e3c78a",
            "#e4e4e4",
            "#ff5189",
            "#ff5d5d",
        ],
        eldritch: [
            "#00FA82",
            "#04d1f9",
            "#10A1BD",
            "#171928",
            "#212337",
            "#292e42",
            "#33C57F",
            "#37f499",
            "#39DDFD",
            "#3b4261",
            "#414868",
            "#5866A2",
            "#6473B7",
            "#7081d0",
            "#722f55",
            "#76639e",
            "#ABB4DA",
            "#a48cf2",
            "#bf4f8e",
            "#c0c95f",
            "#ebfafa",
            "#f0313e",
            "#f16c75",
            "#f1fc79",
            "#f265b5",
            "#f7c67f",
        ],
        "eldritch-darker": [
            "#00cc68",
            "#0396b3",
            "#0c7a94",
            "#0f101a",
            "#171928",
            "#1e2033",
            "#299e64",
            "#2a2e45",
            "#2bafcc",
            "#2d3249",
            "#2dcc82",
            "#3d4775",
            "#445084",
            "#4a5584",
            "#506299",
            "#554971",
            "#5c2644",
            "#8b75d9",
            "#8e94b8",
            "#94407a",
            "#a1a34d",
            "#cc2935",
            "#cc5860",
            "#ccd663",
            "#d154a1",
            "#d4a666",
            "#d8e6e6",
        ],
        bamboo: [
            "#0f0800",
            "#1c1e1b",
            "#252623",
            "#57a5e5",
            "#5b5e5a",
            "#70c2be",
            "#8fb573",
            "#aaaaff",
            "#dbb651",
            "#e75a7c",
            "#f1e9dc",
            "#fff8f0",
        ],
        nightfly: [
            "#011627",
            "#080808",
            "#1d3b53",
            "#21c7a8",
            "#7c8f8f",
            "#7fdbca",
            "#82aaff",
            "#9ca1aa",
            "#a1aab8",
            "#a1cd5e",
            "#ae81ff",
            "#b2ceee",
            "#bdc1c6",
            "#c792ea",
            "#d6deeb",
            "#e3d18a",
            "#ecc48d",
            "#fc514e",
            "#ff5874",
        ],
        poimandres: [
            "#1b1e28",
            "#2a2e3f",
            "#5de4c7",
            "#6c6f93",
            "#89ddff",
            "#a6accd",
            "#add7ff",
            "#d0679d",
            "#d2a6ff",
            "#e4f0fb",
            "#f8f8f2",
            "#fffac2",
            "#ffffff",
        ],
        "poimandres-storm": [
            "#1a1a1a",
            "#252b37",
            "#5de4c7",
            "#89ddff",
            "#a6accd",
            "#add7ff",
            "#d0679d",
            "#f1f1f1",
            "#f2eacf",
            "#fae4fc",
            "#fcc5e9",
            "#fffac2",
            "#ffffff",
        ],
        "night-owl": [
            "#011627",
            "#21c7a8",
            "#22da6e",
            "#575656",
            "#5f7e97",
            "#7e57c2",
            "#7fdbca",
            "#82aaff",
            "#addb67",
            "#c792ea",
            "#d6deeb",
            "#dfe5ee",
            "#ef5350",
            "#ffeb95",
            "#ffffff",
        ],
    }
}
