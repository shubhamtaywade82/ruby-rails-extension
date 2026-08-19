require_relative "boot"
require "rails/all"

module RailsMonolithDemo
  class Application < Rails::Application
    config.load_defaults 7.1
    config.autoload_paths += %W(#{config.root}/app/services)
  end
end
