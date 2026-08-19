class Article < ApplicationRecord
  belongs_to :user
  has_many :comments, dependent: :destroy

  validates :title, presence: true, length: { minimum: 5 }
  validates :body, presence: true

  enum status: { draft: "draft", published: "published", archived: "archived" }

  scope :recent, -> { order(created_at: :desc) }
  scope :published, -> { where(status: :published) }

  def publish!
    update!(status: :published, published_at: Time.current)
  end
end
