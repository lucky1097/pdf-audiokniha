Pod::Spec.new do |s|
  s.name           = 'AudioEncoder'
  s.version        = '1.0.0'
  s.summary        = 'Apple AAC encoder for the audiobook app.'
  s.description    = 'Encodes WAV sentences to AAC .m4a and joins them into one audiobook file, off the WebView and main thread.'
  s.author         = 'pdf-audiokniha'
  s.homepage       = 'https://github.com/lucky1097/pdf-audiokniha'
  s.platforms      = { :ios => '17.0' }
  s.source         = { git: '' }
  s.license        = 'MIT'
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,swift}"
end
