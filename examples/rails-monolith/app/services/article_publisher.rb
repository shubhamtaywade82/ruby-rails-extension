class ArticlePublisher
  attr_reader :article

  def initialize(article)
    @article = article
  end

  def call
    return false if article.published?

    ActiveRecord::Base.transaction do
      article.publish!
      send_notifications
    end
    true
  end

  private

  def send_notifications
    # Simulated notification service call
    puts "Article published: #{article.title}"
  end
end
