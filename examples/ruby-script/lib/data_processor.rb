class DataProcessor
  def parse_sample
    [
      { id: 1, name: "Alpha", active: true },
      { id: 2, name: "Beta", active: false },
      { id: 3, name: "Gamma", active: true }
    ]
  end

  def filter_active(records)
    records.select { |r| r[:active] }
  end
end
