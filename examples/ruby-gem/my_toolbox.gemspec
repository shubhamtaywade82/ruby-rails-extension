Gem::Specification.new do |spec|
  spec.name          = "my_toolbox"
  spec.version       = "0.1.0"
  spec.authors       = ["Shubham Taywade"]
  spec.email         = ["shubhamtaywade82@gmail.com"]
  spec.summary       = "Demo utility gem for RailsForge testing"
  spec.description   = "Provides string and collection transforms"
  spec.homepage      = "https://github.com/example/my_toolbox"
  spec.license       = "MIT"
  spec.required_ruby_version = ">= 3.0.0"

  spec.files         = Dir["lib/**/*.rb", "README.md", "LICENSE"]
  spec.require_paths = ["lib"]

  spec.add_development_dependency "bundler", "~> 2.0"
  spec.add_development_dependency "rake", "~> 13.0"
  spec.add_development_dependency "rspec", "~> 3.12"
  spec.add_development_dependency "rubocop", "~> 1.60"
end
