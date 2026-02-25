namespace Songes_Pour_Les_Noobs
{
    public class Monster
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public string Image { get; set; }
        public int Difficulty { get; set; }
        public int ImmediateFocus { get; set; }
        public int Evasion { get; set; }
        public int Tanking { get; set; }
        public string Information { get; set; }
        public string? Mechanic { get; set; }
        public string Advice { get; set; }

        public string? InformationShort { get; set; }
        public string? MechanicShort { get; set; }
        public string? AdviceShort { get; set; }

        public string? Illustration { get; set; } = null;
        public string? Caption { get; set; } = null;
    }
}
