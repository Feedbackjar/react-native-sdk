require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name         = 'FeedbackJarReactNativeSdk'
  s.version      = package['version']
  s.summary      = package['description']
  s.license      = package['license']
  s.authors      = { 'FeedbackJar' => 'support@feedbackjar.com' }
  s.platforms    = { :ios => '13.0' }
  s.source       = { :git => 'https://github.com/feedbackjar/react-native-sdk.git', :tag => s.version }
  s.source_files = 'ios/**/*.{h,m,mm,swift}'
  s.dependency 'React-Core'
end
