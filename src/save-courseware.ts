import type { PickerWindow } from './app-utils'

export async function saveBlobToFile(blob: Blob, fileName: string) {
  const pickerWindow = window as PickerWindow
  if (typeof pickerWindow.showSaveFilePicker === 'function') {
    const saveHandle = await pickerWindow.showSaveFilePicker!({
      suggestedName: fileName,
      excludeAcceptAllOption: true,
      types: [
        {
          description: 'ENBX 课件文件',
          accept: {
            'application/octet-stream': ['.enbx']
          }
        }
      ]
    })
    const writable = await saveHandle.createWritable()
    await writable.write(blob)
    await writable.close()
    return
  }
  const fileUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = fileUrl
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(fileUrl)
}
