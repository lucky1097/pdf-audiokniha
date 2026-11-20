Pod::Spec.new do |s|
  s.name           = 'TextScanner'
  s.version        = '1.0.0'
  s.summary        = 'Apple document scanner and on-device text recognition for the audiobook app.'
  s.description    = 'Photographs book pages with VisionKit and reads their text with Live Text or Vision, all on the phone.'
  s.author         = 'pdf-audiokniha'
  s.homepage       = 'https://github.com/lucky1097/pdf-audiokniha'
  s.platforms      = { :ios => '17.0' }
  s.source         = { git: '' }
  s.license        = 'MIT'
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,swift}"
end
