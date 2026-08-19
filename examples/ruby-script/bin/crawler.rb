#!/usr/bin/env ruby
require_relative "../lib/data_processor"

puts "Running data extraction script..."
processor = DataProcessor.new
data = processor.parse_sample
puts "Extracted #{data.length} records."
